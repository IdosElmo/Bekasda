// Finished-game history, kept locally per browser.
// Entry: { code, letter, p1, p2, s1, s2, winner, me, at }
//   me — my player number in that game (null in local pass-and-play mode).

import { scoreFor } from './gameLogic.js';

const HISTORY_KEY = 'bekasda:history';
const MAX_ENTRIES = 50;

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Records a finished game once (deduped by room code). Returns the entry.
export function recordFinishedGame({ room, turns, me }) {
  const history = getHistory();
  if (history.some((e) => e.code === room.code)) return null;
  const entry = {
    code: room.code,
    letter: room.letter,
    p1: room.player1_name,
    p2: room.player2_name,
    s1: scoreFor(turns, 1),
    s2: scoreFor(turns, 2),
    winner: room.winner,
    me,
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...history].slice(0, MAX_ENTRIES)));
  } catch {
    /* storage unavailable */
  }
  return entry;
}

export function historyTally() {
  let wins = 0;
  let losses = 0;
  for (const e of getHistory()) {
    if (e.me == null || !e.winner) continue;
    if (e.winner === e.me) wins += 1;
    else losses += 1;
  }
  return { wins, losses };
}
