// GET /api/matches?year=2026   ->  { html }  | { error, expired }
//
// Returns the raw HTML of the user's "My competitions" page for the given year
// (defaults to the current year). The frontend parses it with DOMParser
// (src/parsers/ssi.js) so all SSI-specific markup knowledge lives in one place.

import { ssiFetch, sessionFromRequest, json } from './_ssi.js';

export async function onRequestGet({ request }) {
  const sessionid = sessionFromRequest(request);
  if (!sessionid) {
    return json({ error: 'Not signed in.', expired: true }, 401);
  }

  const url = new URL(request.url);
  const year = (url.searchParams.get('year') || '').replace(/[^0-9]/g, '');
  const path = year ? `/my-events/${year}/` : '/my-events/';

  let res;
  try {
    res = await ssiFetch(path, { method: 'GET', sessionid });
  } catch {
    return json({ error: 'Could not reach Shoot’n Score It.' }, 502);
  }

  // An expired/invalid session redirects (302) to the login page.
  if (res.status === 302 || res.status === 301) {
    return json({ error: 'Your session expired, please sign in again.', expired: true }, 401);
  }

  const html = await res.text();

  // Defensive: SSI sometimes 200s the login page for an expired session.
  if (/name=["']csrfmiddlewaretoken["']/.test(html) && /\/login\//.test(html) && !/my-events/i.test(html)) {
    return json({ error: 'Your session expired, please sign in again.', expired: true }, 401);
  }

  return json({ html });
}
