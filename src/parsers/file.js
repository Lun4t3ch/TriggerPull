// File source: a participant list uploaded by the user (Excel or CSV).
//
// Like ssi.js, this is the only module that knows about the file formats. It
// turns a File into sheets of string rows, guesses where the names are, and
// builds the same neutral participant shape the rest of the app consumes.
//
// Detection is deliberately forgiving — the one job is to get the names out:
//   - the header row may sit below a title / blank rows, or be missing entirely
//   - names may be split (first + last, in either order) or in one cell
//   - "Last, First" in one cell is turned into "First Last"
//   - with no header, a list of common first names decides the column order
//   - totals, numbers, e-mails and repeated headers are skipped

const SOURCE = 'file';

export const ACCEPT = '.xlsx,.xls,.xlsm,.ods,.csv,.tsv,.txt';
const SPREADSHEET_EXT = /\.(xlsx|xls|xlsm|ods)$/i;

function clean(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// File -> sheets: [{ name, rows: string[][] }]
// ---------------------------------------------------------------------------

export async function readSheets(file) {
  const buf = await file.arrayBuffer();
  const sheets = SPREADSHEET_EXT.test(file.name)
    ? await spreadsheetSheets(buf)
    : [{ name: file.name, rows: textRows(decode(buf)) }];
  return sheets.map((s) => ({ ...s, rows: tidy(s.rows) })).filter((s) => s.rows.length);
}

async function spreadsheetSheets(buf) {
  // Loaded on demand so the Excel reader never weighs down the normal SSI flow.
  const XLSX = await import('xlsx');
  const wb = XLSX.read(buf, { type: 'array' });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: false, defval: '' }),
  }));
}

// CSVs saved from Norwegian Excel are often Windows-1252, not UTF-8. Try strict
// UTF-8 first so æøå survive either way.
function decode(buf) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder('windows-1252').decode(buf);
  }
}

function textRows(text) {
  let body = text.replace(/^﻿/, '');
  // Excel's optional "sep=;" hint line.
  let delimiter = null;
  const hint = body.match(/^sep=(.)\r?\n/i);
  if (hint) {
    delimiter = hint[1];
    body = body.slice(hint[0].length);
  }
  return parseDelimited(body, delimiter || guessDelimiter(body));
}

// Pick the delimiter that splits the first lines most consistently. Norwegian
// Excel exports use ";" because "," is the decimal separator. A lone comma per
// line ("Hansen, Ola") is ambiguous; it is split here and the column detection
// below copes with either shape.
function guessDelimiter(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  let best = null;
  let bestScore = 0;
  for (const d of [';', '\t', ',']) {
    const counts = lines.map((l) => l.split(d).length - 1);
    const withIt = counts.filter((c) => c > 0).length;
    if (!withIt) continue;
    // Lines containing it, weighted by how consistent the count is.
    const score = withIt + (new Set(counts).size === 1 ? lines.length : 0);
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best; // null = one name per line
}

// Minimal RFC 4180 parser (quoted fields, escaped quotes, newlines in quotes).
function parseDelimited(text, delimiter) {
  if (!delimiter) return text.split(/\r?\n/).map((l) => [l]);
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  rows.push(row);
  return rows;
}

// Trim cells, drop empty rows, and drop columns that are empty everywhere.
function tidy(rows) {
  const trimmed = rows.map((r) => r.map(clean)).filter((r) => r.some(Boolean));
  const width = Math.max(0, ...trimmed.map((r) => r.length));
  const keep = [];
  for (let c = 0; c < width; c++) {
    if (trimmed.some((r) => r[c])) keep.push(c);
  }
  return trimmed.map((r) => keep.map((c) => r[c] || ''));
}

// ---------------------------------------------------------------------------
// What looks like a name
// ---------------------------------------------------------------------------

// Letters (any script), spaces, hyphens, apostrophes, dots, one comma.
const NAME_CHARS = /^[\p{L}][\p{L}\p{M}' .\-’,]*$/u;
const NOT_NAME_WORDS = /^(totalt?|sum|antall|count|n\/a|na|-|ingen|none)\b/i;

export function looksLikeName(v) {
  return (
    v.length >= 2 &&
    v.length <= 80 &&
    NAME_CHARS.test(v) &&
    (v.match(/,/g) || []).length <= 1 &&
    !NOT_NAME_WORDS.test(v)
  );
}

// Common first names (Nordic + English) — only used to tell a first-name
// column from a last-name column when the file has no header.
const FIRST_NAMES = new Set(
  `ola kari per pål espen anne lars ingrid hans marit jan nina knut liv tor ida erik
  sara jon emma ole nora bjørn hanna arne maria kjell ingeborg terje silje geir hilde
  trond kristin morten camilla rune heidi svein tone stian linn thomas marte martin
  julie anders mari kristian ane jørgen thea magnus emilie henrik sofie andreas ella
  jonas amalie sander frida mathias maja elias leah william olivia oskar sofia filip
  vilde isak tiril noah aksel astrid emil tuva lucas mia mats synne even malin
  eirik siri vegard tonje øyvind randi harald gunn odd berit leif unni roar torill
  sigurd elin håkon inger tobias karin daniel lise jakob eva john mary james linda
  robert michael david richard joseph charles chris mark paul steven anna laura
  peter tom alex sam ben jack tony mike kim robin bente åse aud solveig
  egil alf gunnar ivar rolf asbjørn nils petter tore helge vidar ronny kenneth`.split(/\s+/)
);

function firstNameHits(values) {
  return values.filter((v) => FIRST_NAMES.has(v.toLowerCase().split(/[\s-]/)[0])).length;
}

// ---------------------------------------------------------------------------
// Column detection
// ---------------------------------------------------------------------------

// Header cells that contain "name"/"navn" but are NOT a person's name.
const NOT_PERSON = /klubb|club|lag\b|team|bruker|user|division|divisjon|kategori|category|event|stevne|match|org|firma|company|premie|prize|fil\b|file|middle|mellom|nick|kallenavn/i;

function headerKind(h) {
  // "last_name", "Last-Name", "LastName" -> "last name"
  const t = clean(String(h).replace(/[_.\-]+/g, ' ')).toLowerCase();
  if (!t || t.length > 40 || NOT_PERSON.test(t)) return null;
  const first = /fornavn|first|given|forename|christian name|^f ?name$/.test(t);
  const last = /etternavn|surname|last ?name|family|^last$|^l ?name$/.test(t);
  if (first && last) return 'full'; // e.g. "Etternavn, fornavn" in one column
  if (first) return 'first';
  if (last) return 'last';
  if (/navn|name|deltaker|participant|competitor|skytter|shooter|person|vinner|winner|athlete|player|entrant|contestant|attendee|member|medlem|utøver/.test(t)) return 'full';
  return null;
}

// Guess the import settings: { headerRow, nameCols }.
// headerRow = index of the header row, or -1 for none.
// nameCols  = column indexes joined in that order (so [first, last]).
export function detectColumns(rows) {
  // 1) A recognisable header within the first rows (titles may sit above it).
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const kinds = rows[i].map(headerKind);
    const first = kinds.indexOf('first');
    const last = kinds.indexOf('last');
    const full = kinds.indexOf('full');
    if (first >= 0 && last >= 0) return { headerRow: i, nameCols: [first, last] };
    if (full >= 0) return { headerRow: i, nameCols: [full] };
    if (first >= 0 || last >= 0) return { headerRow: i, nameCols: [Math.max(first, last)] };
  }

  // 2) No header: score each column by how many of its values look like names.
  const width = Math.max(0, ...rows.map((r) => r.length));
  const cols = [];
  for (let c = 0; c < width; c++) {
    const vals = rows.map((r) => r[c] || '').filter(Boolean);
    const named = vals.filter(looksLikeName);
    cols.push({
      c,
      named,
      score: vals.length ? (named.length / vals.length) * named.length : 0,
      singleWord: named.filter((v) => !/[\s,]/.test(v)).length / (named.length || 1),
    });
  }
  const ranked = [...cols].sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score === 0) return { headerRow: -1, nameCols: [0] };

  // Mostly one word per cell → probably first/last split over two columns.
  // Pair with the best other single-word name column, preferably a neighbour.
  if (best.singleWord > 0.7) {
    const partner = cols
      .filter((o) => o.c !== best.c && o.singleWord > 0.7 && o.score >= best.score * 0.6)
      .sort((a, b) => Math.abs(a.c - best.c) - Math.abs(b.c - best.c))[0];
    if (partner) {
      const [a, b] = best.c < partner.c ? [best, partner] : [partner, best];
      // Put the column with more known first names first; tie = file order.
      const swap = firstNameHits(b.named) > firstNameHits(a.named);
      return { headerRow: -1, nameCols: swap ? [b.c, a.c] : [a.c, b.c] };
    }
  }
  return { headerRow: -1, nameCols: [best.c] };
}

// Pick the sheet with the most name-like cells (some workbooks have a cover
// sheet or a results sheet before the participant list).
export function bestSheet(sheets) {
  let best = 0;
  let bestCount = -1;
  sheets.forEach((s, i) => {
    const count = s.rows.reduce((n, r) => n + r.filter(looksLikeName).length, 0);
    if (count > bestCount) {
      best = i;
      bestCount = count;
    }
  });
  return best;
}

// Display label for a column picker: header text, or "Column A".
export function columnLabel(rows, index, headerRow) {
  const letter = String.fromCharCode(65 + (index % 26));
  const h = headerRow >= 0 ? rows[headerRow]?.[index] : '';
  return h ? `${h} (${letter})` : `Column ${letter}`;
}

// ---------------------------------------------------------------------------
// Rows -> names
// ---------------------------------------------------------------------------

// "HANSEN" -> "Hansen", "OLA-MARTIN" -> "Ola-Martin". Mixed case is left alone.
function fixCaps(s) {
  if (s !== s.toUpperCase() || s === s.toLowerCase()) return s;
  return s.toLowerCase().replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep, ch) => sep + ch.toUpperCase());
}

function nameFromParts(parts) {
  const nonEmpty = parts.map(clean).filter(Boolean);
  if (!nonEmpty.length) return '';
  let name;
  if (nonEmpty.length === 1 && /^[^,]+,[^,]+$/.test(nonEmpty[0])) {
    // "Last, First" in one cell -> "First Last"
    const [last, first] = nonEmpty[0].split(',').map(clean);
    name = `${first} ${last}`;
  } else {
    name = nonEmpty.join(' ').replace(/,/g, ' ');
  }
  return fixCaps(clean(name));
}

export function buildNames(rows, { headerRow, nameCols }) {
  const header = headerRow >= 0 ? rows[headerRow].join('|') : null;
  return rows
    .slice(headerRow + 1)
    .filter((r) => r.join('|') !== header) // header repeated on every printed page
    .map((r) => nameCols.map((c) => r[c] || ''))
    .filter((parts) => parts.some(looksLikeName))
    .map(nameFromParts)
    .filter(Boolean);
}

// Neutral participant shape (see parsers/ssi.js parseParticipants).
export function toParticipants(names) {
  return names.map((name, i) => ({
    source: SOURCE,
    id: `file-${i + 1}`,
    name,
    regTimestamp: 0,
    number: '',
    division: '',
    category: '',
    squad: '',
    club: '',
    country: '',
    part: '',
    status: 'IMPORTED',
    statusRaw: '',
    matchRole: '',
    manual: false,
  }));
}

// A stable id for the list, so re-uploading the same file resumes its saved
// review/draw state (state is keyed by match id).
export function listId(fileName, names) {
  let h = 0x811c9dc5; // FNV-1a
  for (const ch of fileName + '\n' + names.join('\n')) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `file-${h.toString(36)}`;
}
