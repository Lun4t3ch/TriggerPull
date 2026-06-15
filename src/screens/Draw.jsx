import { useEffect, useMemo, useRef, useState } from 'react';
import Drum from '../components/Drum.jsx';
import Toast from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Export from './Export.jsx';
import { pickWinner, reelSequence } from '../draw/drawEngine.js';
import { saveDrawSession, loadDrawSession, clearMatchState } from '../state/store.js';

const POST_DRAW_LOCK_MS = 1000;

export default function Draw({ match, initialEntrants, resume, onBackToMatches, onSignOut }) {
  // entrants: { id, name, part, club, state: ACTIVE | CLAIMED | NOT_PRESENT }
  const [entrants, setEntrants] = useState(() => {
    if (resume) {
      const saved = loadDrawSession(match.id);
      if (saved?.entrants) return saved.entrants;
    }
    return (initialEntrants || []).map((e) => ({ ...e, state: 'ACTIVE' }));
  });
  const [winners, setWinners] = useState(() => {
    if (resume) return loadDrawSession(match.id)?.winners || [];
    return [];
  });
  const [drawNumber, setDrawNumber] = useState(() => {
    if (resume) return loadDrawSession(match.id)?.drawNumber || 1;
    return 1;
  });

  const [phase, setPhase] = useState('idle'); // idle | spinning | landed
  const [reel, setReel] = useState([]);
  const [current, setCurrent] = useState(null); // winning entrant during landed
  const [spinId, setSpinId] = useState(0);
  const [locked, setLocked] = useState(false);
  const [toast, setToast] = useState('');
  const [showExport, setShowExport] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const lockTimer = useRef(null);

  const active = useMemo(() => entrants.filter((e) => e.state === 'ACTIVE'), [entrants]);
  const remaining = active.length;
  const exhausted = remaining === 0 && phase === 'idle';

  // Persist after every meaningful change.
  useEffect(() => {
    saveDrawSession(match.id, {
      match: { id: match.id, name: match.name, url: match.url, dateText: match.dateText, sport: match.sport },
      entrants,
      winners,
      drawNumber,
    });
  }, [entrants, winners, drawNumber, match]);

  useEffect(() => () => clearTimeout(lockTimer.current), []);

  function startDraw() {
    if (locked || phase !== 'idle' || remaining === 0) return;
    const winner = pickWinner(active);
    if (!winner) return;
    setCurrent(winner);
    setReel(reelSequence(active, winner));
    setPhase('spinning');
    setLocked(true);
    setSpinId((n) => n + 1);
  }

  function handleLanded() {
    setPhase((p) => (p === 'spinning' ? 'landed' : p));
  }

  function resolve(outcome) {
    if (!current) return;
    setEntrants((list) =>
      list.map((e) => (e.id === current.id ? { ...e, state: outcome } : e))
    );
    setWinners((list) => [
      ...list,
      { drawNo: drawNumber, id: current.id, name: current.name, outcome },
    ]);
    setDrawNumber((n) => n + 1);
    setCurrent(null);
    setPhase('idle');
    // Brief lockout to prevent an accidental double-tap re-draw.
    setLocked(true);
    clearTimeout(lockTimer.current);
    lockTimer.current = setTimeout(() => setLocked(false), POST_DRAW_LOCK_MS);
  }

  function reactivate(entry) {
    setEntrants((list) =>
      list.map((e) => (e.id === entry.id ? { ...e, state: 'ACTIVE' } : e))
    );
    setWinners((list) => list.filter((w) => !(w.id === entry.id && w.drawNo === entry.drawNo)));
    setToast(`${entry.name} returned to draw pool`);
  }

  function startNewRound() {
    setEntrants((list) => list.map((e) => ({ ...e, state: 'ACTIVE' })));
    setWinners([]);
    setDrawNumber(1);
    setPhase('idle');
    setCurrent(null);
    setReel([]);
  }

  function doReset() {
    clearMatchState(match.id);
    setConfirmReset(false);
    onBackToMatches();
  }

  return (
    <div className="app">
      <div className="topbar">
        <div style={{ minWidth: 0 }}>
          <div className="topbar-sub" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {match.name}
          </div>
          <div className="remaining">{remaining} remaining</div>
        </div>
        <div className="row-gap">
          <button className="btn" onClick={() => setShowExport(true)}>Export</button>
          <button className="btn btn-danger btn-ghost" onClick={() => setConfirmReset(true)}>Start over</button>
        </div>
      </div>

      <div className="container">
        <div className="draw-layout">
          <div>
            {exhausted && winners.length > 0 ? (
              <div className="drum empty-pool" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <h2 style={{ margin: '0 0 6px' }}>All participants have been drawn.</h2>
                <p className="muted" style={{ marginTop: 0 }}>Start a new round to draw everyone again.</p>
                <div className="center">
                  <button className="btn btn-primary btn-lg" onClick={startNewRound}>Start new round</button>
                </div>
              </div>
            ) : (
              <Drum
                cells={reel}
                phase={phase}
                winnerName={current?.name}
                spinId={spinId}
                onLanded={handleLanded}
              />
            )}

            <div className="draw-label">Draw #{drawNumber}</div>

            {phase === 'landed' ? (
              <div className="draw-buttons">
                <button className="btn btn-primary btn-lg" onClick={() => resolve('CLAIMED')}>
                  Claimed — Next draw
                </button>
                <button className="btn btn-lg" onClick={() => resolve('NOT_PRESENT')}>
                  Not present
                </button>
              </div>
            ) : (
              !exhausted && (
                <div className="draw-buttons">
                  <button
                    className="btn btn-primary btn-lg btn-block"
                    disabled={locked || phase !== 'idle' || remaining === 0}
                    onClick={startDraw}
                  >
                    {phase === 'spinning' ? 'Drawing…' : 'Draw'}
                  </button>
                </div>
              )
            )}
          </div>

          <div>
            <h3 style={{ marginTop: 0 }}>Winners</h3>
            {winners.length === 0 ? (
              <p className="muted">No draws yet. Tap Draw to begin.</p>
            ) : (
              <div className="winners">
                {[...winners].reverse().map((w) => (
                  <div key={`${w.drawNo}-${w.id}`} className={`winner-row ${w.outcome.toLowerCase()}`}>
                    <span className="wn">#{w.drawNo}</span>
                    <span className="wname">{w.name}</span>
                    <span className={`badge badge-${w.outcome.toLowerCase()}`}>
                      {w.outcome === 'CLAIMED' ? 'Claimed' : 'Not present'}
                    </span>
                    {w.outcome === 'NOT_PRESENT' && (
                      <button
                        className="btn btn-ghost"
                        style={{ padding: '4px 9px', fontSize: 13 }}
                        onClick={() => reactivate(w)}
                      >
                        Reactivate
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <button className="btn btn-ghost" onClick={onBackToMatches}>Back to matches</button>
          <button className="btn btn-ghost" onClick={onSignOut} style={{ marginLeft: 8 }}>Sign out</button>
        </div>
      </div>

      <Toast message={toast} onDone={() => setToast('')} />

      {showExport && (
        <Export matchName={match.name} winners={winners} onBack={() => setShowExport(false)} />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Start over?"
          message="This clears the current draw session for this match and returns to the competition list."
          confirmLabel="Start over"
          danger
          onConfirm={doReset}
          onCancel={() => setConfirmReset(false)}
        />
      )}
    </div>
  );
}
