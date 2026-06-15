// GET /api/participants?matchUrl=/event/22/26445/   ->  { html }  | { error, expired }
//
// Fetches {matchUrl}participants/ and returns the raw HTML for client-side
// parsing. matchUrl must be a relative SSI event path; we validate it to avoid
// turning this into an open proxy.

import { ssiFetch, sessionFromRequest, json } from './_ssi.js';

export async function onRequestGet({ request }) {
  const sessionid = sessionFromRequest(request);
  if (!sessionid) {
    return json({ error: 'Not signed in.', expired: true }, 401);
  }

  const url = new URL(request.url);
  let matchUrl = url.searchParams.get('matchUrl') || '';

  // Only allow relative SSI event paths like /event/22/26445/ (no host, no ..).
  if (!/^\/event\/\d+\/\d+\/?$/.test(matchUrl)) {
    return json({ error: 'Invalid match reference.' }, 400);
  }
  if (!matchUrl.endsWith('/')) matchUrl += '/';

  const path = `${matchUrl}participants/`;

  let res;
  try {
    res = await ssiFetch(path, { method: 'GET', sessionid });
  } catch {
    return json({ error: 'Could not reach Shoot’n Score It.' }, 502);
  }

  if (res.status === 302 || res.status === 301) {
    return json({ error: 'Your session expired, please sign in again.', expired: true }, 401);
  }

  const html = await res.text();

  if (/name=["']csrfmiddlewaretoken["']/.test(html) && /\/login\//.test(html) && !/competitorTable/i.test(html)) {
    return json({ error: 'Your session expired, please sign in again.', expired: true }, 401);
  }

  return json({ html, matchUrl });
}
