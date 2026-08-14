// Best-effort Hebrew dictionary check against he.wiktionary + he.wikipedia
// (MediaWiki API, CORS-enabled with origin=*).
//
// Returns: true  — the word has an entry somewhere
//          false — no entry found on any source
//          null  — could not check (network trouble); callers should fail open.

const SOURCES = [
  'https://he.wiktionary.org/w/api.php',
  'https://he.wikipedia.org/w/api.php',
];

const cache = new Map();

async function existsOn(base, word) {
  const url = `${base}?action=query&format=json&origin=*&redirects=1&titles=${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const pages = Object.values(data?.query?.pages ?? {});
  return pages.some((p) => p.pageid && !('missing' in p));
}

export async function isRealWord(raw) {
  const word = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!word) return false;
  if (cache.has(word)) return cache.get(word);

  let sawError = false;
  for (const base of SOURCES) {
    try {
      if (await existsOn(base, word)) {
        cache.set(word, true);
        return true;
      }
    } catch {
      sawError = true;
    }
  }
  if (sawError) return null; // unknown — do not cache, do not block
  cache.set(word, false);
  return false;
}
