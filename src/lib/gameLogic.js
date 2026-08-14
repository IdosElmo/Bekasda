// Core rules and validation for בקסדה.

export const HEBREW_LETTERS = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ',
  'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
];

export const MAX_WORDS_PER_TURN = 3;

const FINAL_TO_REGULAR = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function randomLetter() {
  return HEBREW_LETTERS[Math.floor(Math.random() * HEBREW_LETTERS.length)];
}

// Canonical form used for duplicate detection: trimmed, single-spaced,
// final letters folded to their regular form, punctuation stripped.
export function normalizeWord(raw) {
  return (raw ?? '')
    .trim()
    .replace(/["'׳״]/g, '')
    .replace(/\s+/g, ' ')
    .split('')
    .map((ch) => FINAL_TO_REGULAR[ch] ?? ch)
    .join('');
}

const HEBREW_WORD_RE = /^[א-ת]['׳]?(?:[א-ת"'׳״\s-]*[א-ת]['׳]?)?$/;

// Validates a single candidate word against the game letter and the set of
// already-used normalized words. Returns { ok: true } or { ok: false, error }.
export function validateWord(raw, letter, usedNormalized) {
  const word = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!word) return { ok: false, error: 'מילה ריקה' };
  if (!HEBREW_WORD_RE.test(word)) {
    return { ok: false, error: 'רק אותיות בעברית' };
  }
  if (word[0] !== letter) {
    return { ok: false, error: `חייב להתחיל באות ${letter}` };
  }
  if (usedNormalized.has(normalizeWord(word))) {
    return { ok: false, error: 'המילה כבר נאמרה במשחק!' };
  }
  return { ok: true, word };
}

// Validates a whole turn (1-3 words), including duplicates inside the turn itself.
export function validateTurn(rawWords, letter, usedNormalized) {
  const filled = rawWords.map((w) => (w ?? '').trim());
  if (filled.every((w) => !w)) {
    return { ok: false, errors: {}, general: 'צריך לפחות מילה אחת' };
  }
  const errors = {};
  const words = [];
  const seenThisTurn = new Set();
  filled.forEach((w, i) => {
    if (!w) return;
    const res = validateWord(w, letter, usedNormalized);
    if (!res.ok) {
      errors[i] = res.error;
      return;
    }
    const norm = normalizeWord(w);
    if (seenThisTurn.has(norm)) {
      errors[i] = 'מילה כפולה באותו תור';
      return;
    }
    seenThisTurn.add(norm);
    words.push(res.word);
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (words.length > MAX_WORDS_PER_TURN) {
    return { ok: false, errors: {}, general: `עד ${MAX_WORDS_PER_TURN} מילים בתור` };
  }
  return { ok: true, words };
}

// Set of normalized words already played in the game.
export function usedWordsSet(turns) {
  const used = new Set();
  for (const turn of turns) {
    for (const w of turn.words ?? []) used.add(normalizeWord(w));
  }
  return used;
}

export function scoreFor(turns, player) {
  return turns
    .filter((t) => t.player === player && t.action === 'words')
    .reduce((sum, t) => sum + (t.words?.length ?? 0), 0);
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode() {
  let code = '';
  for (let i = 0; i < 5; i += 1) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export function relativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'ממש עכשיו';
  if (minutes < 60) return `לפני ${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  const days = Math.floor(hours / 24);
  return `לפני ${days} ימים`;
}
