// POST /api/login  { username, password }  ->  { sessionid }  | { error }
//
// Observed SSI behaviour (verified against the live site):
//   - GET /login/ returns a plain form with NO csrfmiddlewaretoken field and
//     sets NO cookies. The endpoint is CSRF-exempt.
//   - The form fields are: username (email), password, keep ("keep me logged
//     in" checkbox). It posts to /login/?next=...
//   - A *successful* login responds with a Set-Cookie: sessionid (302 redirect).
//   - A *failed* login responds 200 with the form again and NO sessionid cookie.
//
// So: post the credentials directly and treat "sessionid was set" as success.
// We still best-effort pick up a csrftoken cookie / token if a future SSI
// change reintroduces them, but their absence is not an error.

import {
  SSI_ORIGIN,
  ssiFetch,
  extractCsrfToken,
  getSetCookies,
  findCookieAcross,
  json,
} from './_ssi.js';

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request body.' }, 400);
  }

  const username = (body.username || '').trim();
  const password = body.password || '';
  if (!username || !password) {
    return json({ error: 'Username and password are required.' }, 400);
  }

  // Best-effort priming: grab any cookie/token SSI might set (currently none).
  let cookieHeader = '';
  let token = null;
  try {
    const page = await ssiFetch('/login/', { method: 'GET' });
    const html = await page.text();
    token = extractCsrfToken(html);
    const csrftoken = findCookieAcross(getSetCookies(page.headers), 'csrftoken');
    if (csrftoken) cookieHeader = `csrftoken=${csrftoken}`;
  } catch {
    /* non-fatal — the login POST does not require a token */
  }

  const form = new URLSearchParams();
  form.set('username', username);
  form.set('password', password);
  form.set('keep', 'on'); // request a durable session for scraping
  form.set('next', '/');
  if (token) form.set('csrfmiddlewaretoken', token);

  let postRes;
  try {
    postRes = await fetch(SSI_ORIGIN + '/login/', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': SSI_ORIGIN + '/login/',
        'Origin': SSI_ORIGIN,
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: form.toString(),
    });
  } catch {
    return json({ error: 'Could not reach Shoot’n Score It.' }, 502);
  }

  const sessionid = findCookieAcross(getSetCookies(postRes.headers), 'sessionid');
  if (sessionid) {
    return json({ sessionid });
  }

  return json({ error: 'Login failed. Check your username and password.' }, 401);
}

export function onRequestGet() {
  return json({ error: 'Use POST to sign in.' }, 405);
}
