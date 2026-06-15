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

// SSI's competitor table does NOT have a fixed column layout — depending on the
// match config (pre-match on/off, classification on/off, paid on/off, etc.) the
// columns shift. So we locate each field by its distinctive markup rather than
// by a fixed cell index, which keeps parsing correct across very different
// matches.

const STATUS_TITLES = new Set(['approved', 'pending', 'waiting list', 'deleted']);

// The participant's own detail link ends in /event/participant/{x}/{id}/ — the
// action links (edit, delete, toggle-favourite) have extra path after the id.
const NAME_HREF = /\/event\/participant\/\d+\/\d+\/$/;

function rowName(tr) {
  // The row may contain several /event/participant/{x}/{id}/ links (a name link
  // and an icon-only "view" link). Take the first one with actual text.
  for (const a of tr.querySelectorAll('a[href]')) {
    if (NAME_HREF.test(a.getAttribute('href') || '')) {
      const t = clean(a.textContent);
      if (t) return t;
    }
  }
  return '';
}

function rowNameCell(tr) {
  for (const td of tr.querySelectorAll('td')) {
    for (const a of td.querySelectorAll('a[href]')) {
      if (NAME_HREF.test(a.getAttribute('href') || '') && clean(a.textContent)) return td;
    }
  }
  return null;
}

// Participant id: the organizer view has a checkbox carrying it; the
// competitor view (no checkboxes) exposes it only via the detail link
// /event/participant/{x}/{id}/.
function rowId(tr) {
  const cb = tr.querySelector('input[name="competitor"]');
  if (cb && cb.value) return cb.value;
  for (const a of tr.querySelectorAll('a[href]')) {
    const m = (a.getAttribute('href') || '').match(/\/event\/participant\/\d+\/(\d+)\/$/);
    if (m) return m[1];
  }
  return null;
}

function rowStatusRaw(tr) {
  // Preferred: the status toggle link's <abbr title="Approved|Pending|...">.
  const a = tr.querySelector('a[href*="toggle-status"] abbr');
  if (a) return clean(a.getAttribute('title') || a.textContent);
  // Fallback: any abbr whose title is a recognised status.
  for (const abbr of tr.querySelectorAll('abbr')) {
    if (STATUS_TITLES.has(clean(abbr.getAttribute('title')).toLowerCase())) {
      return clean(abbr.getAttribute('title'));
    }
  }
  return '';
}

function rowPart(tr) {
  for (const abbr of tr.querySelectorAll('abbr')) {
    const t = clean(abbr.getAttribute('title')).toLowerCase();
    if (t.includes('pre-match') || t.includes('pre match')) return 'PM';
    if (t.includes('main-match') || t.includes('main match')) return 'MM';
  }
  return 'MM';
}

function rowMatchRole(tr) {
  for (const abbr of tr.querySelectorAll('abbr')) {
    const title = clean(abbr.getAttribute('title'));
    if (/officer|director|quarter master|stats|chrono/i.test(title)) {
      const m = title.match(/\(([A-Za-z]{2,4})\)/);
      return m ? m[1] : clean(abbr.textContent);
    }
  }
  return '';
}

// Returns { participants: [...], summaryText, counts: { accepted, pending, waitlisted, removed, total } }
export function parseParticipants(html) {
  const d = doc(html);
  const participants = [];

  const rows = d.querySelectorAll('#competitorTable tbody tr');
  rows.forEach((tr) => {
    const id = rowId(tr);
    if (!id) return;

    const name = rowName(tr);
    if (!name) return;

    const tsSpan =
      tr.querySelector('span[style*="display:none"]') || tr.querySelector('td span');
    const regTimestamp = tsSpan ? parseInt(clean(tsSpan.textContent), 10) : 0;

    const statusRaw = rowStatusRaw(tr);
    const status = normalizeStatus(statusRaw);

    // Display-only metadata — best-effort and layout-tolerant.
    const nTd = rowNameCell(tr);
    const division = clean(nTd?.nextElementSibling?.textContent || '');
    const squadLink = tr.querySelector('a[href*="/event/squad/"]');
    const squad = squadLink ? clean(squadLink.textContent) : '';
    const orgLink = tr.querySelector('a[href^="/organization/"]');
    const club = orgLink ? clean(orgLink.textContent) : '';
    const flagCell = [...tr.querySelectorAll('td')].find((td) => td.querySelector('.flag'));
    const country = flagCell
      ? clean(flagCell.querySelector('abbr')?.getAttribute('title') || '')
      : '';

    participants.push({
      source: SOURCE,
      id,
      name,
      regTimestamp: Number.isFinite(regTimestamp) ? regTimestamp : 0,
      number: '',
      division,
      category: '',
      squad,
      club,
      country,
      part: rowPart(tr), // 'MM' | 'PM'
      status, // ACCEPTED | PENDING | WAITLISTED | REMOVED | UNKNOWN
      statusRaw,
      matchRole: rowMatchRole(tr),
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
