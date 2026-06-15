// PracticeScore / PractiScore parser — future drop-in source.
//
// Implement the same two functions as ssi.js and the rest of the app
// (draw engine + UI) works unchanged, because they only consume the neutral
// shapes documented below.
//
//   parseMatches(html|json)      -> { matches: [{ source, id, url, name,
//                                       timestamp, dateText, status, sport,
//                                       role, registered, capacity }], years,
//                                       currentYear }
//
//   parseParticipants(html|json) -> { participants: [{ source, id, name,
//                                       regTimestamp, number, division,
//                                       category, squad, club, country, part,
//                                       status, statusRaw, matchRole, manual }],
//                                       summaryText, counts }
//
// `status` must be one of: ACCEPTED | PENDING | WAITLISTED | REMOVED | UNKNOWN.

export function parseMatches() {
  throw new Error('PractiScore source not implemented yet.');
}

export function parseParticipants() {
  throw new Error('PractiScore source not implemented yet.');
}
