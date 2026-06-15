// POST /api/login  { username, password }  ->  { sessionid }  | { error }
//
// Two-step Django login:
//   1. GET /login/        -> read csrfmiddlewaretoken (hidden field) + csrftoken cookie
//   2. POST /login/       -> credentials + token; success returns a sessionid cookie
//
// Credentials are used once to obtain the sessionid and are never stored.

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

  // Step 1 — fetch the login form for the CSRF token + cookie.
  let loginPage;
  try {
    loginPage = await ssiFetch('/login/', { method: 'GET' });
  } catch {
    return json({ error: 'Could not reach Shoot’n Score It.' }, 502);
  }

  const pageHtml = await loginPage.text();
  const csrftoken = findCookieAcross(getSetCookies(loginPage.headers), 'csrftoken');
  const formToken = extractCsrfToken(pageHtml) || csrftoken;

  if (!formToken) {
    return json(
      { error: 'Login is temporarily unavailable (no CSRF token).' },
      502
    );
  }

  // Step 2 — post the credentials. Django requires a matching csrftoken cookie
  // and, over HTTPS, a same-origin Referer.
  const form = new URLSearchParams();
  form.set('username', username);
  form.set('password', password);
  form.set('csrfmiddlewaretoken', formToken);
  form.set('next', '/');

  const cookieParts = [];
  if (csrftoken) cookieParts.push(`csrftoken=${csrftoken}`);

  let postRes;
  try {
    postRes = await fetch(SSI_ORIGIN + '/login/', {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': SSI_ORIGIN + '/login/',
        'Origin': SSI_ORIGIN,
        ...(cookieParts.length ? { Cookie: cookieParts.join('; ') } : {}),
      },
      body: form.toString(),
    });
  } catch {
    return json({ error: 'Could not reach Shoot’n Score It.' }, 502);
  }

  const sessionid = findCookieAcross(getSetCookies(postRes.headers), 'sessionid');

  // Success: SSI sets a sessionid cookie (usually with a 302 to "/"). On
  // failure it returns 200 with the login page again and no sessionid.
  if (sessionid) {
    return json({ sessionid });
  }

  return json(
    { error: 'Login failed. Check your username and password.' },
    401
  );
}

// Helpful response for accidental GETs.
export function onRequestGet() {
  return json({ error: 'Use POST to sign in.' }, 405);
}
