// Thin wrapper around the Pages Functions proxy. The sessionid travels in a
// custom header (not a cookie) so it stays readable to JS, per the brief.

import { getSession } from '../state/store.js';

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (auth) {
    const sid = getSession();
    if (sid) headers['X-SSI-Session'] = sid;
  }

  let res;
  try {
    res = await fetch(path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Network error — could not reach the server.', 0, false);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON error page */
  }

  if (!res.ok) {
    throw new ApiError(
      data.error || `Request failed (${res.status}).`,
      res.status,
      Boolean(data.expired)
    );
  }
  return data;
}

export class ApiError extends Error {
  constructor(message, status, expired) {
    super(message);
    this.status = status;
    this.expired = expired;
  }
}

export function login(username, password) {
  return request('/api/login', { method: 'POST', body: { username, password }, auth: false });
}

export function fetchMatchesHtml(year) {
  const q = year ? `?year=${encodeURIComponent(year)}` : '';
  return request(`/api/matches${q}`);
}

export function fetchParticipantsHtml(matchUrl) {
  return request(`/api/participants?matchUrl=${encodeURIComponent(matchUrl)}`);
}
