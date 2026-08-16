// Backend abstraction: Supabase when configured (async multiplayer between
// devices), otherwise a localStorage backend (pass-and-play on one browser).
//
// Room shape:   { code, letter, player1_name, player2_name, current_turn,
//                 status: 'waiting' | 'playing' | 'finished',
//                 winner, win_reason, created_at, updated_at }
// Turn shape:   { player: 1|2, action: 'words'|'pass'|'concede',
//                 words: string[], created_at }

import { createClient } from '@supabase/supabase-js';
import { makeRoomCode, scoreFor } from './gameLogic.js';
import { getMyRooms, removeMyRoom } from './storage.js';
import { recordFinishedGame, getHistory } from './history.js';

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

// Shared client — also used by auth.js for Google sign-in. Null in local mode.
export const supabaseClient = isOnlineMode ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

/* ------------------------------ Supabase ------------------------------ */

function createSupabaseBackend() {
  const supabase = supabaseClient;

  // Marks the room finished. The essential update goes first; score stamping
  // is best-effort so a missing migration can't block the game from ending.
  async function finishRoom(code, winner, scores = null) {
    const { error } = await supabase
      .from('rooms')
      .update({ status: 'finished', winner, win_reason: 'pass', updated_at: new Date().toISOString() })
      .eq('code', code)
      .eq('status', 'playing');
    if (error) throw error;
    try {
      let { score1, score2 } = scores ?? {};
      if (score1 == null) {
        const { data: turns } = await supabase.from('turns').select('player, action, words').eq('room_code', code);
        score1 = scoreFor(turns ?? [], 1);
        score2 = scoreFor(turns ?? [], 2);
      }
      await supabase.from('rooms').update({ score1, score2 }).eq('code', code);
    } catch {
      /* score columns are best-effort */
    }
  }

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

    async createRoom({ letter, playerName, playerId }) {
      // Retry on the (unlikely) chance of a room-code collision.
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const code = makeRoomCode();
        const { data, error } = await supabase
          .from('rooms')
          .insert({ code, letter, player1_name: playerName, player1_id: playerId, status: 'waiting', current_turn: 1 })
          .select()
          .single();
        if (!error) return data;
        if (error.code !== '23505') throw error;
      }
      throw new Error('לא הצלחנו ליצור חדר, נסו שוב');
    },

    getRoom,

    async joinRoom(code, playerName, playerId) {
      const { data, error } = await supabase
        .from('rooms')
        .update({ player2_name: playerName, player2_id: playerId, status: 'playing', updated_at: new Date().toISOString() })
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

    // "No more words". With fewer/equal points the passer loses immediately;
    // with a lead, the turn flips and the opponent gets ONE last-chance turn
    // (a 'pass' turn while the room is still 'playing' encodes that state).
    async passTurn({ code, player }) {
      const { data: turns, error: turnsError } = await supabase
        .from('turns').select('player, action, words').eq('room_code', code);
      if (turnsError) throw turnsError;
      const myScore = scoreFor(turns ?? [], player);
      const oppScore = scoreFor(turns ?? [], player === 1 ? 2 : 1);
      const { error: insertError } = await supabase
        .from('turns')
        .insert({ room_code: code, player, action: 'pass', words: [] });
      if (insertError) throw insertError;

      if (myScore > oppScore) {
        const { error } = await supabase
          .from('rooms')
          .update({ current_turn: player === 1 ? 2 : 1, updated_at: new Date().toISOString() })
          .eq('code', code)
          .eq('current_turn', player);
        if (error) throw error;
        return { lastChance: true };
      }
      await finishRoom(code, player === 1 ? 2 : 1);
      return { lastChance: false };
    },

    // A chase turn: the trailing player keeps submitting (up to 3 words per
    // turn) until they EXCEED the passer's score — win the moment they do —
    // or give up with words=[] and lose. The turn never flips back.
    async submitLastChance({ code, player, words }) {
      const { error: insertError } = await supabase
        .from('turns')
        .insert({ room_code: code, player, action: words.length ? 'words' : 'pass', words });
      if (insertError) throw insertError;
      const { data: turns, error: turnsError } = await supabase
        .from('turns').select('player, action, words').eq('room_code', code);
      if (turnsError) throw turnsError;
      const s1 = scoreFor(turns ?? [], 1);
      const s2 = scoreFor(turns ?? [], 2);
      const passer = player === 1 ? 2 : 1;
      const myScore = player === 1 ? s1 : s2;
      const passerScore = passer === 1 ? s1 : s2;
      if (words.length === 0) {
        await finishRoom(code, passer, { score1: s1, score2: s2 });
        return { finished: true };
      }
      if (myScore > passerScore) {
        await finishRoom(code, player, { score1: s1, score2: s2 });
        return { finished: true };
      }
      // Not there yet — keep the chase going (touch the room for freshness).
      await supabase
        .from('rooms')
        .update({ updated_at: new Date().toISOString() })
        .eq('code', code);
      return { finished: false };
    },

    // Everything this player is part of: open games + finished games (the
    // finished rooms ARE the history — they are kept, not deleted). Accepts
    // several ids so a signed-in user still sees games played as a guest.
    async listMyGames({ playerIds }) {
      const ids = (playerIds ?? []).filter(Boolean);
      if (ids.length === 0) return { active: [], finished: [] };
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .or(ids.flatMap((id) => [`player1_id.eq.${id}`, `player2_id.eq.${id}`]).join(','))
        .order('updated_at', { ascending: false })
        .limit(60);
      if (error) throw error;
      const rooms = data ?? [];
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const active = rooms.filter(
        (r) => r.status === 'playing'
          || (r.status === 'waiting' && new Date(r.updated_at).getTime() > weekAgo)
      );
      const finished = rooms
        .filter((r) => r.status === 'finished')
        .slice(0, 50)
        .map((r) => ({
          code: r.code,
          letter: r.letter,
          p1: r.player1_name,
          p2: r.player2_name,
          s1: r.score1 ?? 0,
          s2: r.score2 ?? 0,
          winner: r.winner,
          me: ids.includes(r.player1_id) ? 1 : 2,
          at: r.updated_at,
        }));
      return { active, finished };
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

    async joinRoom(code, playerName, _playerId) {
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

    async passTurn({ code, player }) {
      const state = readLocal(code);
      if (!state) throw new Error('החדר לא נמצא');
      const now = new Date().toISOString();
      const myScore = scoreFor(state.turns, player);
      const oppScore = scoreFor(state.turns, player === 1 ? 2 : 1);
      state.turns.push({ player, action: 'pass', words: [], created_at: now });
      state.room.updated_at = now;
      if (myScore > oppScore) {
        state.room.current_turn = player === 1 ? 2 : 1;
        writeLocal(code, state);
        return { lastChance: true };
      }
      state.room.status = 'finished';
      state.room.winner = player === 1 ? 2 : 1;
      state.room.win_reason = 'pass';
      writeLocal(code, state);
      return { lastChance: false };
    },

    async submitLastChance({ code, player, words }) {
      const state = readLocal(code);
      if (!state) throw new Error('החדר לא נמצא');
      const now = new Date().toISOString();
      state.turns.push({ player, action: words.length ? 'words' : 'pass', words, created_at: now });
      state.room.updated_at = now;
      const passer = player === 1 ? 2 : 1;
      const myScore = scoreFor(state.turns, player);
      const passerScore = scoreFor(state.turns, passer);
      if (words.length === 0 || myScore > passerScore) {
        state.room.status = 'finished';
        state.room.winner = words.length === 0 ? passer : player;
        state.room.win_reason = 'pass';
        writeLocal(code, state);
        return { finished: true };
      }
      writeLocal(code, state);
      return { finished: false };
    },

    // Local pass-and-play: one shared device, so delete once it's been seen.
    async deleteRoom(code) {
      try {
        localStorage.removeItem(LOCAL_PREFIX + code);
      } catch {
        /* ignore */
      }
    },

    // Local mode keeps history in localStorage; finished rooms found here
    // (e.g. never revisited) get recorded and cleaned up on the spot.
    async listMyGames() {
      const active = [];
      for (const code of getMyRooms()) {
        const state = readLocal(code);
        if (!state) {
          removeMyRoom(code);
          continue;
        }
        if (state.room.status === 'finished') {
          recordFinishedGame({ room: state.room, turns: state.turns, me: null });
          removeMyRoom(code);
          this.deleteRoom(code);
          continue;
        }
        active.push(state.room);
      }
      return { active, finished: getHistory() };
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
