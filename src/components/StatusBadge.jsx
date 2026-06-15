// Status -> coloured badge. Covers participant statuses, manual entries, and
// the draw outcome chips.

const LABELS = {
  ACCEPTED: 'Accepted',
  PENDING: 'Pending',
  WAITLISTED: 'Waitlisted',
  REMOVED: 'Removed',
  UNKNOWN: 'Unknown',
  MANUAL: 'Manual',
  CLAIMED: 'Claimed',
  NOT_PRESENT: 'Not present',
};

export default function StatusBadge({ status, raw }) {
  const cls = `badge badge-${(status || 'unknown').toLowerCase()}`;
  const label = LABELS[status] || raw || status;
  return <span className={cls}>{label}</span>;
}
