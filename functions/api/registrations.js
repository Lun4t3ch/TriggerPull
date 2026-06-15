// GET /api/registrations?year=2026  ->  { html }  | { error, expired }
//
// Raw HTML of the user's "Registrations" page (matches they're signed up for as
// a competitor). Parsed client-side by src/parsers/ssi.js (parseRegistrations).

import { ssiFetch, sessionFromRequest, json } from './_ssi.js';

export async function onRequestGet({ request }) {
  const sessionid = sessionFromRequest(request);
  if (!sessionid) {
    return json({ error: 'Not signed in.', expired: true }, 401);
  }

  const url = new URL(request.url);
  const year = (url.searchParams.get('year') || '').replace(/[^0-9]/g, '');
  const path = year ? `/my-registrations/${year}/` : '/my-registrations/';

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

  if (/name=["']csrfmiddlewaretoken["']/.test(html) && /\/login\//.test(html) && !/my-registrations/i.test(html)) {
    return json({ error: 'Your session expired, please sign in again.', expired: true }, 401);
  }

  return json({ html });
}
