// Backend abstraction: Supabase when configured (async multiplayer between
// devices), otherwise a localStorage backend (pass-and-play on one browser).
//
// Room shape:   { code, letter, player1_name, player2_name, current_turn,
//                 status: 'waiting' | 'playing' | 'finished',
//                 winner, win_reason, created_at, updated_at }
// Turn shape:   { player: 1|2, action: 'words'|'pass'|'concede',
//                 words: string[], created_at }

import { createClient } from '@supabase/supabase-js';
import { makeRoomCode } from './gameLogic.js';

// Tolerate common paste mistakes in the project URL: trailing slashes, an API
// path suffix like /rest/v1, or even the dashboard URL instead of the API host.
function normalizeSupabaseUrl(raw) {
  let url = (raw ?? '').trim().replace(/\/+$/, '');
  if (!url) return url;
  const dashboard = url.match(/^https:\/\/(?:app\.|www\.)?supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboard) return `https://${dashboard[1]}.supabase.co`;
  url = url.replace(/\/(?:rest|auth|realtime|storage|functions)\/v\d+$/i, '');
  return url.replace(/\/+$/, '');
}

const SUPABASE_URL = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL);
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export const isOnlineMode = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ------------------------------ Supabase ------------------------------ */

function createSupabaseBackend() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function getRoom(code) {
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', code)
      .maybeSingle();
    if (error) throw error;
    if (!room) return null;
    const { data: turns, error: turnsError } = await supabase
      .from('turns')
      .select('*')
      .eq('room_code', code)
      .order('id', { ascending: true });
    if (turnsError) throw turnsError;
    return { room, turns: turns ?? [] };
  }

  return {
    mode: 'supabase',

    async createRoom({ letter, playerName }) {
      // Retry on the (unlikely) chance of a room-code collision.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const code = makeRoomCode();
        const { data, error } = await supabase
          .from('rooms')
          .insert({ code, letter, player1_name: playerName, status: 'waiting', current_turn: 1 })
          .select()
          .single();
        if (!error) return data;
        if (error.code !== '23505') throw error;
      }
      throw new Error('לא הצלחנו ליצור חדר, נסו שוב');
    },

    getRoom,

    async joinRoom(code, playerName) {
      const { data, error } = await supabase
        .from('rooms')
        .update({ player2_name: playerName, status: 'playing', updated_at: new Date().toISOString() })
        .eq('code', code)
        .is('player2_name', null)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('החדר כבר מלא');
      return data;
    },

    async submitTurn({ code, player, words }) {
      const { error: turnError } = await supabase
        .from('turns')
        .insert({ room_code: code, player, action: 'words', words });
      if (turnError) throw turnError;
      const { data, error } = await supabase
        .from('rooms')
        .update({ current_turn: player === 1 ? 2 : 1, updated_at: new Date().toISOString() })
        .eq('code', code)
        .eq('current_turn', player)
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },

    async endGame({ code, player, action }) {
      const { error: turnError } = await supabase
        .from('turns')
        .insert({ room_code: code, player, action, words: [] });
      if (turnError) throw turnError;
      const { error } = await supabase
        .from('rooms')
        .update({
          status: 'finished',
          winner: player === 1 ? 2 : 1,
          win_reason: action,
          updated_at: new Date().toISOString(),
        })
        .eq('code', code)
        .eq('status', 'playing');
      if (error) throw error;
    },

    // Realtime changes push a refetch; a slow poll covers missed events.
    subscribe(code, onChange) {
      const refetch = async () => {
        try {
          const state = await getRoom(code);
          if (state) onChange(state);
        } catch {
          /* transient network error — next event/poll retries */
        }
      };
      const channel = supabase
        .channel(`room-${code}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `code=eq.${code}` }, refetch)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'turns', filter: `room_code=eq.${code}` }, refetch)
        .subscribe();
      const poll = setInterval(refetch, 15000);
      return () => {
        clearInterval(poll);
        supabase.removeChannel(channel);
      };
    },
  };
}

/* ----------------------- localStorage (fallback) ----------------------- */

const LOCAL_PREFIX = 'bekasda:room:';

function readLocal(code) {
  try {
    const raw = localStorage.getItem(LOCAL_PREFIX + code);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocal(code, state) {
  localStorage.setItem(LOCAL_PREFIX + code, JSON.stringify(state));
}

function createLocalBackend() {
  return {
    mode: 'local',

    async createRoom({ letter, playerName }) {
      const code = makeRoomCode();
      const now = new Date().toISOString();
      const room = {
        code,
        letter,
        player1_name: playerName,
        player2_name: null,
        current_turn: 1,
        status: 'waiting',
        winner: null,
        win_reason: null,
        created_at: now,
        updated_at: now,
      };
      writeLocal(code, { room, turns: [] });
      return room;
    },

    async getRoom(code) {
      return readLocal(code);
    },

    async joinRoom(code, playerName) {
      const state = readLocal(code);
      if (!state) throw new Error('החדר לא נמצא');
      if (state.room.player2_name) throw new Error('החדר כבר מלא');
      state.room.player2_name = playerName;
      state.room.status = 'playing';
      state.room.updated_at = new Date().toISOString();
      writeLocal(code, state);
      return state.room;
    },

    async submitTurn({ code, player, words }) {
      const state = readLocal(code);
      if (!state) throw new Error('החדר לא נמצא');
      const now = new Date().toISOString();
      state.turns.push({ player, action: 'words', words, created_at: now });
      state.room.current_turn = player === 1 ? 2 : 1;
      state.room.updated_at = now;
      writeLocal(code, state);
      return state.room;
    },

    async endGame({ code, player, action }) {
      const state = readLocal(code);
      if (!state) throw new Error('החדר לא נמצא');
      const now = new Date().toISOString();
      state.turns.push({ player, action, words: [], created_at: now });
      state.room.status = 'finished';
      state.room.winner = player === 1 ? 2 : 1;
      state.room.win_reason = action;
      state.room.updated_at = now;
      writeLocal(code, state);
    },

    subscribe(code, onChange) {
      let lastSnapshot = '';
      const check = () => {
        const state = readLocal(code);
        if (!state) return;
        const snapshot = JSON.stringify(state);
        if (snapshot !== lastSnapshot) {
          lastSnapshot = snapshot;
          onChange(state);
        }
      };
      const onStorage = (e) => {
        if (e.key === LOCAL_PREFIX + code) check();
      };
      window.addEventListener('storage', onStorage);
      const poll = setInterval(check, 2000);
      return () => {
        window.removeEventListener('storage', onStorage);
        clearInterval(poll);
      };
    },
  };
}

export const backend = isOnlineMode ? createSupabaseBackend() : createLocalBackend();
