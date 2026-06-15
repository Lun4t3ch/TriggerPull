// SSI (Shoot'n Score It) parsers.
//
// All knowledge of SSI's HTML lives here. The draw engine and UI work with the
// neutral shapes returned below, so a different source (see practiscore.js) can
// be dropped in without touching anything else.
//
// Selectors below were derived from real logged-in SSI pages:
//   - /my-events/{year}/      -> table#sortTable          (parseMatches)
//   - /event/{s}/{id}/participants/ -> table#competitorTable (parseParticipants)

const SOURCE = 'ssi';

function doc(html) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Match list  (/my-events/{year}/)
// ---------------------------------------------------------------------------

// Returns { matches: [...], years: [2024,...], currentYear: 2026 }
export function parseMatches(html) {
  const d = doc(html);
  const matches = [];

  const rows = d.querySelectorAll('#sortTable tbody tr');
  rows.forEach((tr) => {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 6) return;

    const link = cells[1].querySelector('a[href^="/event/"]');
    if (!link) return;

    const url = normalizeEventUrl(link.getAttribute('href'));
    const ids = url.match(/^\/event\/(\d+)\/(\d+)\//);
    if (!ids) return;

    // Hidden <span> holds a unix timestamp for reliable sorting.
    const tsSpan = cells[0].querySelector('span');
    const ts = tsSpan ? parseInt(clean(tsSpan.textContent), 10) : 0;

    // Visible date text sits after the hidden span.
    const dateText = clean(cells[0].textContent);

    // Strip the "premium" sup label from the event name.
    const nameClone = link.cloneNode(true);
    nameClone.querySelectorAll('sup').forEach((s) => s.remove());

    const compText = clean(cells[5].textContent); // "27/30"
    const [registered, capacity] = compText.split('/').map((n) => parseInt(n, 10));

    matches.push({
      source: SOURCE,
      sportCode: ids[1],
      id: ids[2],
      url, // e.g. /event/22/26445/
      name: clean(nameClone.textContent),
      timestamp: Number.isFinite(ts) ? ts : 0,
      dateText,
      status: clean(cells[2].textContent), // Completed / Active / Cancelled
      sport: clean(cells[3].textContent),
      role: clean(cells[4].textContent), // admin / assistant / staff
      registered: Number.isFinite(registered) ? registered : null,
      capacity: Number.isFinite(capacity) ? capacity : null,
    });
  });

  // Newest first within the year.
  matches.sort((a, b) => b.timestamp - a.timestamp);

  return {
    matches,
    years: parseYears(d),
    currentYear: parseCurrentYear(d),
  };
}

function parseYears(d) {
  const years = new Set();
  d.querySelectorAll('a[href^="/my-events/"]').forEach((a) => {
    const m = a.getAttribute('href').match(/\/my-events\/(\d{4})\//);
    if (m) years.add(parseInt(m[1], 10));
  });
  // The current (active) year is shown as a non-link <strong>.
  const cur = parseCurrentYear(d);
  if (cur) years.add(cur);
  return [...years].sort((a, b) => b - a);
}

function parseCurrentYear(d) {
  const strong = d.querySelector('.btn-outline-dark strong');
  if (strong) {
    const y = parseInt(clean(strong.textContent), 10);
    if (Number.isFinite(y)) return y;
  }
  const title = clean(d.querySelector('title')?.textContent || '');
  const m = title.match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

// ---------------------------------------------------------------------------
// Participants  (/event/{s}/{id}/participants/)
// ---------------------------------------------------------------------------

// Status mapping from the <abbr title="..."> (unambiguous, unlike the letter).
const STATUS_MAP = {
  approved: 'ACCEPTED',
  pending: 'PENDING',
  'waiting list': 'WAITLISTED',
  deleted: 'REMOVED',
};

export function normalizeStatus(rawTitle) {
  const key = clean(rawTitle).toLowerCase();
  return STATUS_MAP[key] || 'UNKNOWN';
}

function abbrTitle(cell) {
  const abbr = cell?.querySelector('abbr');
  if (abbr) return clean(abbr.getAttribute('title') || abbr.textContent);
  return clean(cell?.textContent || '');
}

// Returns { participants: [...], summaryText, counts: { accepted, pending, waitlisted, removed, total } }
export function parseParticipants(html) {
  const d = doc(html);
  const participants = [];

  const rows = d.querySelectorAll('#competitorTable tbody tr');
  rows.forEach((tr) => {
    const cells = tr.querySelectorAll('td');
    if (cells.length < 12) return;

    const checkbox = cells[0].querySelector('input[name="competitor"]');
    const id = checkbox ? checkbox.value : null;
    if (!id) return;

    const tsSpan = cells[0].querySelector('span');
    const regTimestamp = tsSpan ? parseInt(clean(tsSpan.textContent), 10) : 0;

    const nameLink = cells[3].querySelector('a');
    const name = clean(nameLink ? nameLink.textContent : cells[3].textContent);
    if (!name) return;

    const partTitle = abbrTitle(cells[10]).toLowerCase(); // "main-match" / "pre-match"
    const part = partTitle.includes('pre') ? 'PM' : 'MM';

    const statusRaw = abbrTitle(cells[11]);
    const status = normalizeStatus(statusRaw);

    const matchRole = abbrTitle(cells[13]); // -, RO, MD, QM ...

    participants.push({
      source: SOURCE,
      id,
      name,
      regTimestamp: Number.isFinite(regTimestamp) ? regTimestamp : 0,
      number: clean(cells[2].textContent),
      division: clean(cells[4].textContent),
      category: abbrTitle(cells[5]),
      squad: clean(cells[7].textContent),
      club: clean(cells[8].textContent),
      country: abbrTitle(cells[9]),
      part, // 'MM' | 'PM'
      status, // ACCEPTED | PENDING | WAITLISTED | REMOVED | UNKNOWN
      statusRaw,
      matchRole: matchRole && matchRole !== '-' ? matchRole : '',
      manual: false,
    });
  });

  return {
    participants,
    summaryText: clean(d.querySelector('#competitor-start p')?.textContent || ''),
    counts: tallyStatuses(participants),
  };
}

function tallyStatuses(list) {
  const c = { accepted: 0, pending: 0, waitlisted: 0, removed: 0, unknown: 0, total: list.length };
  for (const p of list) {
    if (p.status === 'ACCEPTED') c.accepted++;
    else if (p.status === 'PENDING') c.pending++;
    else if (p.status === 'WAITLISTED') c.waitlisted++;
    else if (p.status === 'REMOVED') c.removed++;
    else c.unknown++;
  }
  return c;
}

// ---------------------------------------------------------------------------

function normalizeEventUrl(href) {
  // Keep only the /event/{sport}/{id}/ portion, dropping any query string.
  const m = href.match(/^(\/event\/\d+\/\d+\/)/);
  return m ? m[1] : href;
}
