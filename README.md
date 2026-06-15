# TriggerPull

An animated **prize-draw (trekkpremie)** tool for IPSC shooting competitions.
A match organizer signs in with their **Shoot'n Score It (SSI)** account, picks
one of their competitions, washes the participant list, and runs a slot-machine
style draw in front of an audience — projector- and phone-friendly.

- **Frontend:** React (Vite single-page app)
- **Backend:** Cloudflare Pages Functions (`/functions/api/*`) — a thin
  server-side proxy to SSI that handles CSRF, session cookies, and CORS
- **State:** `localStorage` / `sessionStorage` only — no database
- **Cost:** runs entirely on Cloudflare's free tier

---

## How the SSI login & proxy works

The browser never talks to SSI directly (CORS + cookie restrictions). Every SSI
request goes through the Pages Functions in [`functions/api/`](functions/api):

| Endpoint | What it does |
|---|---|
| `POST /api/login` | Two-step Django login: `GET /login/` to read the `csrfmiddlewaretoken` + `csrftoken` cookie, then `POST /login/` with the credentials. On success SSI returns a `sessionid` cookie, which we return to the frontend in the JSON body. **Credentials are never stored** — only the session token is kept. |
| `GET /api/matches?year=YYYY` | Returns the raw HTML of `/my-events/{year}/` (the "My competitions" page). |
| `GET /api/participants?matchUrl=/event/{s}/{id}/` | Returns the raw HTML of `{matchUrl}participants/`. |

The frontend sends the session token in an `X-SSI-Session` header (kept in JS,
not a cookie, so it survives refresh and stays readable). The Worker forwards it
to SSI as `Cookie: sessionid=…`.

All SSI-specific HTML parsing lives in **one file**,
[`src/parsers/ssi.js`](src/parsers/ssi.js) (`parseMatches`, `parseParticipants`),
using the browser's `DOMParser`. The selectors were derived from real
logged-in SSI pages.

### Status mapping

The participants table's `<abbr title="…">` drives the badges and default draw
pool:

| SSI status | App status | Included by default |
|---|---|---|
| Approved | `ACCEPTED` | ✅ (both Main-match **and** Pre-match) |
| Pending | `PENDING` | ❌ (add manually on the review screen) |
| Waiting list | `WAITLISTED` | ❌ |
| Deleted | `REMOVED` | ❌ |

---

## App flow

```
LOGIN → MATCH SELECT → PARTICIPANT REVIEW (the "wash") → DRAW ↔ EXPORT
```

1. **Login** — SSI credentials, privacy disclaimer, remember-me.
2. **Match select** — your competitions, newest first, with year navigation and
   client-side search.
3. **Participant review** — toggle individuals, filter Main-match / Pre-match,
   add manual entries, then **Start draw**.
4. **Draw** — slot-machine drum; per winner choose *Claimed* or *Not present*;
   reactivate no-shows; *Start new round* when the pool is exhausted.
5. **Export** — copy as TSV or download CSV, any time, without losing the draw.

Draw and review state is persisted in `localStorage` keyed by match id, so a
refresh offers to **resume** an in-progress draw.

---

## Local development

> Requires Node 18+ and npm.

```bash
npm install

# Run the SPA + the Pages Functions proxy together (recommended — the SSI
# login/scrape calls need the Functions runtime):
npx wrangler pages dev -- npm run dev
# then open the URL Wrangler prints (Functions on :8788, Vite on :5173).
```

`npm run dev` alone serves the UI but `/api/*` calls will 404 without Wrangler.
`vite.config.js` proxies `/api` to `http://localhost:8788` during dev.

---

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Pages → Create a project → Connect to Git**, select
   the repo.
3. Build settings:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Functions in `/functions` are detected and deployed automatically.
4. Deploy. The SPA and the `/api/*` proxy are served from the same origin, so no
   CORS configuration is needed.

No environment variables are required (see `.env.example`).

---

## Adding another participant source (e.g. PractiScore)

The draw engine ([`src/draw/`](src/draw)) and UI have **zero knowledge** of where
participants come from — they only consume the neutral shapes returned by the
parsers. To add a source:

1. Implement `parseMatches` and `parseParticipants` in
   [`src/parsers/practiscore.js`](src/parsers/practiscore.js), returning the same
   shapes documented at the top of that file (status must be one of
   `ACCEPTED | PENDING | WAITLISTED | REMOVED | UNKNOWN`).
2. Add matching proxy endpoint(s) under `functions/api/` if the source needs a
   server-side fetch.
3. Pick the parser based on the selected source — nothing in `src/draw/` or the
   screens needs to change.

---

## Project structure

```
functions/api/        Cloudflare Pages Functions (SSI proxy)
  _ssi.js             shared SSI/CSRF helpers
  login.js            POST /api/login
  matches.js          GET  /api/matches
  participants.js     GET  /api/participants
src/
  api/client.js       frontend fetch wrapper (sends X-SSI-Session)
  parsers/ssi.js      SSI HTML → neutral data (the only SSI-aware module)
  parsers/practiscore.js  future drop-in source
  draw/drawEngine.js  source-agnostic winner picking + reel
  state/store.js      localStorage / sessionStorage persistence + resume
  components/         Drum, StatusBadge, Toast, ConfirmDialog
  screens/            Login, MatchSelect, ParticipantReview, Draw, Export
  styles/theme.css    dark + brass design system
  App.jsx             screen state machine + resume prompt
```
