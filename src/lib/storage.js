// Small localStorage helpers: per-room player identity + preferred display name.

const IDENTITY_PREFIX = 'bekasda:identity:';
const NAME_KEY = 'bekasda:name';

export function getIdentity(code) {
  try {
    const raw = localStorage.getItem(IDENTITY_PREFIX + code);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setIdentity(code, identity) {
  try {
    localStorage.setItem(IDENTITY_PREFIX + code, JSON.stringify(identity));
  } catch {
    /* storage unavailable — identity just won't persist */
  }
}

export function getSavedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignore */
  }
}
