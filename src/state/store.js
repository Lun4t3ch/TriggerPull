// Persistence layer. Session token lives in localStorage (remember me) or
// sessionStorage (this tab only). Draw/review state is keyed by match id in
// localStorage so a session can be resumed after a refresh.

const K = {
  session: 'tp.session',
  remember: 'tp.remember',
  user: 'tp.user',
  review: (id) => `tp.review.${id}`,
  draw: (id) => `tp.draw.${id}`,
};

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// --- Session token -------------------------------------------------------

export function saveSession(sessionid, remember, username) {
  clearSessionStorageToken();
  const store = remember ? localStorage : sessionStorage;
  store.setItem(K.session, sessionid);
  localStorage.setItem(K.remember, remember ? '1' : '0');
  if (username) localStorage.setItem(K.user, username);
}

export function getSession() {
  return localStorage.getItem(K.session) || sessionStorage.getItem(K.session) || null;
}

export function getUsername() {
  return localStorage.getItem(K.user) || '';
}

function clearSessionStorageToken() {
  localStorage.removeItem(K.session);
  sessionStorage.removeItem(K.session);
}

// Full sign-out: drop the token but keep saved draw state on disk (harmless,
// and lets a re-login resume). Use clearEverything() for a hard reset.
export function clearSession() {
  clearSessionStorageToken();
  localStorage.removeItem(K.remember);
  localStorage.removeItem(K.user);
}

// --- Review state (participant inclusion) --------------------------------

export function saveReviewState(matchId, data) {
  localStorage.setItem(K.review(matchId), JSON.stringify({ ...data, updatedAt: Date.now() }));
}

export function loadReviewState(matchId) {
  return safeParse(localStorage.getItem(K.review(matchId)));
}

export function clearReviewState(matchId) {
  localStorage.removeItem(K.review(matchId));
}

// --- Draw session --------------------------------------------------------

export function saveDrawSession(matchId, data) {
  localStorage.setItem(K.draw(matchId), JSON.stringify({ ...data, updatedAt: Date.now() }));
}

export function loadDrawSession(matchId) {
  return safeParse(localStorage.getItem(K.draw(matchId)));
}

export function clearDrawSession(matchId) {
  localStorage.removeItem(K.draw(matchId));
}

// Find the most recently updated in-progress draw session for the resume
// prompt. "In progress" = at least one draw completed and entrants remain.
export function findResumableDraw() {
  let best = null;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith('tp.draw.')) continue;
    const data = safeParse(localStorage.getItem(key));
    if (!data || !Array.isArray(data.winners) || data.winners.length === 0) continue;
    if (!best || (data.updatedAt || 0) > (best.updatedAt || 0)) best = data;
  }
  return best;
}

export function clearMatchState(matchId) {
  clearReviewState(matchId);
  clearDrawSession(matchId);
}
