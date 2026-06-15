// Shared helpers for the Cloudflare Pages Functions that proxy Shoot'n Score It.
//
// SSI runs on Django with standard session auth + CSRF protection. The browser
// never talks to SSI directly (CORS + cookie restrictions); everything goes
// through these server-side functions. We forward the user's `sessionid` as a
// Cookie when scraping, and we never store credentials anywhere.

export const SSI_ORIGIN = 'https://shootnscoreit.com';

const COMMON_HEADERS = {
  // Pretend to be a normal browser. SSI is lenient, but some Django/WAF setups
  // reject requests with a missing or odd User-Agent.
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  'Accept-Language': 'en;q=0.9',
};

// Parse a single cookie value out of one or more Set-Cookie header strings.
export function readCookie(setCookieValue, name) {
  if (!setCookieValue) return null;
  // A Workers Headers.get('set-cookie') may concatenate multiple cookies with
  // ", " — but commas also appear in Expires=. Match the name=value pair
  // directly instead of splitting.
  const re = new RegExp('(?:^|[;,\\s])' + name + '=([^;,\\s]+)');
  const m = setCookieValue.match(re);
  return m ? m[1] : null;
}

// Collect Set-Cookie headers robustly across runtimes. Cloudflare Workers
// expose `Headers.getSetCookie()`; fall back to `.get('set-cookie')`.
export function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const raw = headers.get('set-cookie');
  return raw ? [raw] : [];
}

export function findCookieAcross(setCookies, name) {
  for (const c of setCookies) {
    const v = readCookie(c, name);
    if (v) return v;
  }
  return null;
}

// Extract the hidden csrfmiddlewaretoken from a Django form page.
export function extractCsrfToken(html) {
  const m = html.match(
    /name=["']csrfmiddlewaretoken["']\s+value=["']([^"']+)["']/i
  );
  if (m) return m[1];
  // Some templates render value before name.
  const m2 = html.match(
    /value=["']([^"']+)["']\s+name=["']csrfmiddlewaretoken["']/i
  );
  return m2 ? m2[1] : null;
}

// Fetch an SSI page using the caller's sessionid cookie. Returns the Response
// so callers can inspect status/redirects.
export function ssiFetch(path, { sessionid, ...init } = {}) {
  const url = path.startsWith('http') ? path : SSI_ORIGIN + path;
  const headers = { ...COMMON_HEADERS, ...(init.headers || {}) };
  if (sessionid) {
    headers['Cookie'] = `sessionid=${sessionid}`;
  }
  return fetch(url, { ...init, headers, redirect: 'manual' });
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// Pull the sessionid the frontend sent us. We accept it via a custom header
// (preferred, set by our API client) or the Authorization bearer for
// convenience.
export function sessionFromRequest(request) {
  return (
    request.headers.get('X-SSI-Session') ||
    (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') ||
    null
  );
}
