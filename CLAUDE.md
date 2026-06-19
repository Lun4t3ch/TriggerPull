# CLAUDE.md — project context for TriggerPull

This file gives a brand-new Claude Code session everything it needs to be
productive immediately. Read it first.

> The owner (Tony / GitHub `Lun4t3ch`) is a **non-coder** and communicates in
> **Norwegian** — reply in Norwegian, explain things simply, and do the git/
> build/deploy work for him. Keep changes shippable. The app UI itself is in
> **English**.

---

## 1. What TriggerPull is

TriggerPull is an **animated prize-draw (trekkpremie) tool for IPSC shooting
competitions**, used live in front of an audience (projector or phone). Target
domain: **https://triggerpull.org**.

A match organizer signs in with their **Shoot'n Score It (SSI)** account, picks
one of their competitions, "washes" the participant list (add/remove/toggle),
then runs a slot-machine style draw. Flow:

```
LOGIN → MATCH SELECT → PARTICIPANT REVIEW ("wash") → DRAW ↔ EXPORT
```

- **Login** — SSI email + password, privacy disclaimer, remember-me.
- **Match select** — the user's competitions (newest first), year navigation,
  client-side search, and a toggle **"Only matches I crew or admin"** (on =
  matches you organize/staff; off = also matches you only compete in).
- **Participant review** — the draw pool. Default included = **Approved**
  competitors (both Main-match and Pre-match). Pending/Waiting/Deleted are
  excluded but addable. MM/PM filter, manual add, select/deselect all.
- **Draw** — tap **Draw** once; after the drum lands, **Claimed** or
  **Not present** each record the outcome *and* immediately spin the next draw
  (one tap per winner). No-shows can be **Reactivated** (back to pool) or
  **Claimed** in place if they turn up. **Start new round** when the pool is
  exhausted.
- **Export** — overlay reachable any time; copy as TSV or download CSV.

Draw + review state is persisted in `localStorage` keyed by match id, so a
refresh offers to **resume** an in-progress draw.

---

## 2. Tech stack

- **Frontend:** React 18 + Vite, **plain JavaScript / JSX (no TypeScript)**,
  hand-written CSS (dark `#111214` + brass `#C9933A` theme), no UI framework.
- **Backend:** **Cloudflare Pages Functions** in `functions/api/*` — a thin
  server-side proxy to SSI (handles cookies/CORS; SSI can't be called directly
  from the browser).
- **State:** `localStorage` / `sessionStorage` only — **no database**.
- **Hosting:** **Cloudflare Pages** (free tier), auto-deployed from GitHub.

---

## 3. Repository map

```
TriggerPull/
├── package.json            scripts (dev/build/preview) + deps
├── vite.config.js          dev server; proxies /api -> http://localhost:8788 (Wrangler)
├── index.html              app shell + Google Fonts (Inter, DM Mono)
├── .env.example            documents that NO env vars are required
├── README.md               developer-facing readme (setup/deploy/parsers)
├── RECOVERY.md             beginner steps to restore on a new PC
├── functions/
│   └── api/                Cloudflare Pages Functions (the SSI proxy)
│       ├── _ssi.js         shared SSI helpers (fetch, cookie parsing, json)
│       ├── login.js        POST /api/login   (CSRF-exempt SSI login)
│       ├── matches.js      GET  /api/matches?year=        (/my-events/)
│       ├── registrations.js GET /api/registrations?year=  (/my-registrations/)
│       └── participants.js GET  /api/participants?matchUrl=  ({matchUrl}participants/)
└── src/
    ├── main.jsx            React entry
    ├── App.jsx             screen state machine + resume prompt
    ├── api/client.js       frontend fetch wrapper (sends X-SSI-Session header)
    ├── parsers/
    │   ├── ssi.js          ALL SSI HTML parsing lives here (the only SSI-aware module)
    │   └── practiscore.js  stub for a future drop-in source (see §7)
    ├── draw/drawEngine.js  source-agnostic winner pick + reel builder
    ├── state/store.js      localStorage/sessionStorage persistence + resume
    ├── screens/            Login, MatchSelect, ParticipantReview, Draw, Export
    ├── components/         Drum, StatusBadge, Toast, ConfirmDialog
    └── styles/theme.css    the whole theme
```

---

## 4. Architecture & key decisions

- **SSI proxy (server-side).** The browser never talks to SSI directly. Every
  SSI request goes through `functions/api/*`. The frontend sends the SSI
  session token in an **`X-SSI-Session`** header (kept in JS so it survives a
  refresh); the Worker forwards it to SSI as `Cookie: sessionid=…`. **No
  credentials are ever stored** — only the session token.

- **SSI login is CSRF-exempt (verified against the live site).** Unlike a
  textbook Django login, `GET /login/` has **no** `csrfmiddlewaretoken` and
  sets **no** cookie; the form fields are `username`, `password`, `keep`. A
  successful POST returns a `sessionid` cookie; a failed one returns 200 with no
  cookie. `login.js` posts the credentials directly and treats "got a sessionid"
  as success. (Don't reintroduce a hard CSRF-token requirement — it breaks login.)

- **All SSI HTML knowledge is isolated in `src/parsers/ssi.js`.** Exposes
  `parseMatches`, `parseRegistrations`, `parseParticipants`, `normalizeStatus`.
  The draw engine and screens only consume neutral shapes, so a different source
  could be added without touching them.

- **Parsing is markup-based, NOT column-index based.** SSI's competitor table
  changes column count/order between matches (pre-match on/off, classification
  on/off, etc.). Fields are located by their distinctive markup:
  - id: checkbox `input[name=competitor]` **or**, when absent, the
    `/event/participant/{x}/{id}/` detail link.
  - name: first `/event/participant/{x}/{id}/` link with non-empty text.
  - status: `a[href*=toggle-status] abbr` title, else first `<abbr>` whose title
    is Approved/Pending/Waiting list/Deleted → `ACCEPTED|PENDING|WAITLISTED|REMOVED|UNKNOWN`.
  - part (MM/PM): the `<abbr>` titled "Main-match" / "Pre-match".

- **Two participant page layouts.** Organizer view has checkboxes + a
  `toggle-status` link; competitor/staff view has neither (status is a plain
  `<abbr>`). The parser handles both, so draws work whether you're organizer or
  just a competitor on a match.

- **Match list = `/my-events/` (+ optionally `/my-registrations/`).**
  `/my-events/` is "My competitions" (organizer/staff). The toggle merges in
  `/my-registrations/` (competitor-only) when off; duplicates are de-duped by
  the `/event/{sport}/{id}/` URL, with the organizer entry winning. Both pages
  use table `#sortTable` with a hidden unix-timestamp `<span>` for sorting.

- **Draw is source-agnostic** (`src/draw/drawEngine.js`): `pickWinner` uses
  `crypto.getRandomValues` (rejection-sampled, unbiased) when available; the
  drum reel ends on the predetermined winner. The Draw screen owns the round
  state and persists it.

- **PractiScore was investigated and shelved** — see §7.

---

## 5. Run / build / deploy

**Important env note (this machine):** Node is installed at
`C:\Program Files\nodejs` but is **not on the tool's default PATH**. In the
**PowerShell** tool, prepend it first:
```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
```
The **Bash** tool does NOT see Node — use PowerShell for npm/node work.

- **Local dev (UI + the /api proxy together):**
  ```powershell
  npm install
  npx wrangler pages dev -- npm run dev
  ```
  Open the URL Wrangler prints. `npm run dev` alone serves the UI but `/api/*`
  will 404 without Wrangler.
- **Production build:** `npm run build` → output in `dist/`.

**Deploy:** hosted on **Cloudflare Pages**, project **`triggerpull`**, at
**https://triggerpull.pages.dev** and **https://triggerpull.org** (+ `www`).
- Build command: `npm run build` · Build output dir: `dist` · Functions in
  `/functions` are detected automatically · no env vars required.
- **Push to `main` → Cloudflare auto-builds and deploys.** That is the entire
  deploy step.

**Git for this project** (gh CLI is **NOT** installed; use Git directly):
- Repo: **GitHub `Lun4t3ch/TriggerPull`**, default branch `main`.
- Auth: **Git Credential Manager** (system helper `manager`) holds the GitHub
  login, so HTTPS pushes succeed non-interactively. (Repo was created via the
  GitHub API using the token GCM stored — `gh` is unavailable.)
- Commit + push on the owner's behalf when he approves. End commit messages with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

---

## 6. Current status (working & live)

Live on triggerpull.org, used with real IPSC matches. Working: SSI login,
match list (My Competitions + optional Registrations toggle), participant review
with MM/PM filter + manual add, the slot-machine draw with one-tap
Claimed/Not-present chaining, Claim-in-place + Reactivate for no-shows, new
round, CSV/TSV export, resume after refresh, long-name handling in the drum.

---

## 7. Known issues / constraints

- **PractiScore is not feasible via this proxy model (shelved).** Its login
  form has a **Cloudflare Turnstile CAPTCHA** (a server can't solve it) and its
  match/results pages sit behind Cloudflare's "Just a moment" **bot challenge**
  (server fetch → HTTP 403). Only a real logged-in browser gets through. If
  revisited, the path is **paste-import** (user copies a roster from their own
  browser and pastes it; parse client-side) or a **browser extension** — not
  server scraping. `src/parsers/practiscore.js` documents the drop-in contract.
- **Parsing depends on SSI's HTML.** If SSI changes its markup, a parser in
  `src/parsers/ssi.js` may need updating. To debug, get a **View Source** of the
  affected SSI page (logged in) and adjust the relevant `parse*` function.
- **No automated tests.** Verification is manual + occasional throwaway recon
  (the SSI login page is public and can be `curl`-ed to inspect the form).
- **Draws need the roster.** SSI only shows a full participant list to people
  with access to that match; for some matches a non-organizer may not see it.
- **No persistence beyond the browser** (by design — localStorage only).

---

## 8. Next steps / ideas (not started)

- **PractiScore via paste-import** — a "Paste a list" source that accepts a
  pasted roster (or plain names, one per line) and feeds the same draw. Sidesteps
  all of PractiScore's anti-bot blocking. Universal across any source.
- **More export options / themes**, sound effects on the reveal, etc.
- **Tighten parsers** further if new SSI match configurations surface.
