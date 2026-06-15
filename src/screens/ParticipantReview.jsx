import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchParticipantsHtml, ApiError } from '../api/client.js';
import { parseParticipants } from '../parsers/ssi.js';
import { saveReviewState, loadReviewState, clearMatchState } from '../state/store.js';
import StatusBadge from '../components/StatusBadge.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';

// A participant is included by default only when Approved (ACCEPTED) — applies
// to both Main-match and Pre-match, per the agreed spec.
function defaultIncluded(p) {
  return p.status === 'ACCEPTED';
}

export default function ParticipantReview({ match, onStartDraw, onBack, onSignOut, onExpired }) {
  const [participants, setParticipants] = useState(null);
  const [summaryText, setSummaryText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('ALL'); // ALL | MM | PM
  const [newName, setNewName] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  const manualSeq = useRef(0);

  // Load saved "wash" state if present, otherwise scrape + apply defaults.
  useEffect(() => {
    let alive = true;
    const saved = loadReviewState(match.id);
    if (saved && Array.isArray(saved.participants)) {
      setParticipants(saved.participants);
      setSummaryText(saved.summaryText || '');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    fetchParticipantsHtml(match.url)
      .then(({ html }) => {
        if (!alive) return;
        const { participants: parsed, summaryText } = parseParticipants(html);
        setParticipants(parsed.map((p) => ({ ...p, included: defaultIncluded(p) })));
        setSummaryText(summaryText);
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError && err.expired) return onExpired();
        setError(err.message || 'Could not load participants.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [match.id, match.url, onExpired]);

  // Persist whenever the list changes.
  useEffect(() => {
    if (participants) {
      saveReviewState(match.id, { matchName: match.name, summaryText, participants });
    }
  }, [participants, match.id, match.name, summaryText]);

  const visible = useMemo(() => {
    if (!participants) return [];
    if (filter === 'ALL') return participants;
    return participants.filter((p) => p.manual || p.part === filter);
  }, [participants, filter]);

  const includedCount = participants ? participants.filter((p) => p.included).length : 0;
  const total = participants ? participants.length : 0;

  function toggle(id) {
    setParticipants((list) =>
      list.map((p) => (p.id === id ? { ...p, included: !p.included } : p))
    );
  }

  function setAllVisible(value) {
    const ids = new Set(visible.map((p) => p.id));
    setParticipants((list) =>
      list.map((p) => (ids.has(p.id) ? { ...p, included: value } : p))
    );
  }

  function addManual(e) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    manualSeq.current += 1;
    setParticipants((list) => [
      ...list,
      {
        id: `manual-${manualSeq.current}-${Date.now()}`,
        name,
        status: 'MANUAL',
        part: 'MM',
        manual: true,
        included: true,
        division: '',
        club: '',
        category: '',
        matchRole: '',
      },
    ]);
    setNewName('');
  }

  function removeManual(id) {
    setParticipants((list) => list.filter((p) => p.id !== id));
  }

  function start() {
    const entrants = participants
      .filter((p) => p.included)
      .map((p) => ({ id: p.id, name: p.name, part: p.part, club: p.club }));
    onStartDraw(entrants);
  }

  function doReset() {
    clearMatchState(match.id);
    setConfirmReset(false);
    onBack();
  }

  return (
    <div className="app">
      <div className="topbar">
        <div style={{ minWidth: 0 }}>
          <div className="topbar-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {match.name}
          </div>
          <div className="topbar-sub">{match.dateText} · {match.sport}</div>
        </div>
        <div className="row-gap">
          <button className="btn btn-ghost" onClick={onBack}>Back</button>
          <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <div className="container">
        {loading && (
          <div className="loading-wrap"><span className="spinner" /> Loading participants…</div>
        )}

        {error && !loading && (
          <div className="card"><div className="error-msg">{error}</div></div>
        )}

        {!loading && !error && participants && (
          <>
            <div className="review-head">
              <div>
                <h2 style={{ margin: '0 0 4px' }}>Review participants</h2>
                {summaryText && <div className="summary-line">{summaryText}</div>}
              </div>
              <div className="filter-tabs">
                {[
                  ['ALL', 'All'],
                  ['MM', 'Main-match'],
                  ['PM', 'Pre-match'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={`chip ${filter === key ? 'active' : ''}`}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar">
              <form onSubmit={addManual} className="row-gap" style={{ flex: 1 }}>
                <input
                  className="input"
                  placeholder="Add participant manually…"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button className="btn" type="submit">Add</button>
              </form>
              <button className="btn btn-ghost" onClick={() => setAllVisible(true)}>Select all</button>
              <button className="btn btn-ghost" onClick={() => setAllVisible(false)}>Deselect all</button>
            </div>

            <div className="plist">
              {visible.map((p) => (
                <label key={p.id} className={`prow ${p.included ? '' : 'excluded'}`}>
                  <input
                    type="checkbox"
                    checked={p.included}
                    onChange={() => toggle(p.id)}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="pname">{p.name}</div>
                    <div className="pmeta">
                      {[p.club, p.division, p.category].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="badges">
                    {p.part && !p.manual && <span className="badge badge-part">{p.part}</span>}
                    {p.matchRole && <span className="badge badge-role">{p.matchRole}</span>}
                    <StatusBadge status={p.status} raw={p.statusRaw} />
                    {p.manual && (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ padding: '4px 9px', fontSize: 13 }}
                        onClick={(e) => { e.preventDefault(); removeManual(p.id); }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </label>
              ))}
            </div>

            <div className="sticky-actions">
              <div className="row-gap" style={{ alignItems: 'center' }}>
                <strong className="remaining">{includedCount}</strong>
                <span className="muted">of {total} participants included in draw</span>
              </div>
              <div className="row-gap">
                <button className="btn btn-danger btn-ghost" onClick={() => setConfirmReset(true)}>
                  Start over
                </button>
                <button className="btn btn-primary btn-lg" disabled={includedCount === 0} onClick={start}>
                  Start draw →
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmReset && (
        <ConfirmDialog
          title="Start over?"
          message="This clears your participant selection for this match and returns to the competition list."
          confirmLabel="Start over"
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
