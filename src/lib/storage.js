// Small localStorage helpers: per-room player identity, preferred display
// name, and the list of rooms this browser is playing in.

const IDENTITY_PREFIX = 'bekasda:identity:';
const NAME_KEY = 'bekasda:name';
const MY_ROOMS_KEY = 'bekasda:my-rooms';

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

export function getMyRooms() {
  try {
    const raw = localStorage.getItem(MY_ROOMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addMyRoom(code) {
  try {
    const rooms = getMyRooms();
    if (!rooms.includes(code)) {
      localStorage.setItem(MY_ROOMS_KEY, JSON.stringify([code, ...rooms].slice(0, 30)));
    }
  } catch {
    /* ignore */
  }
}

export function removeMyRoom(code) {
  try {
    localStorage.setItem(MY_ROOMS_KEY, JSON.stringify(getMyRooms().filter((c) => c !== code)));
  } catch {
    /* ignore */
  }
}
