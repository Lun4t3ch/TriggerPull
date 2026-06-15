import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const CELL_H = 84; // must match .drum-cell height in theme.css
const DRUM_H = 260; // must match .drum height
const SPIN_MS = 3600;

// Top offset that centres cell `i` inside the drum window.
function offsetFor(i) {
  return DRUM_H / 2 - CELL_H / 2 - i * CELL_H;
}

// phase: 'idle' | 'spinning' | 'landed'
export default function Drum({ cells, phase, winnerName, spinId, onLanded }) {
  const stripRef = useRef(null);
  const [transform, setTransform] = useState(offsetFor(0));
  const [transition, setTransition] = useState('none');

  // Kick off a spin whenever spinId changes while spinning.
  useLayoutEffect(() => {
    if (phase !== 'spinning' || !cells.length) return;
    // Start at the top with no transition…
    setTransition('none');
    setTransform(offsetFor(0));
    // …then on the next frame, ease down to the winner (last cell).
    const raf = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTransition(`transform ${SPIN_MS}ms cubic-bezier(0.12, 0.78, 0.12, 1)`);
        setTransform(offsetFor(cells.length - 1));
      });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId]);

  // Safety net in case the transitionend event is missed.
  useEffect(() => {
    if (phase !== 'spinning') return;
    const t = setTimeout(() => onLanded && onLanded(), SPIN_MS + 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinId, phase]);

  const handleEnd = (e) => {
    if (e.propertyName === 'transform' && phase === 'spinning') {
      onLanded && onLanded();
    }
  };

  return (
    <div className={`drum ${phase === 'landed' ? 'landed' : ''}`}>
      <div className="drum-fade-top" />
      <div className="drum-fade-bottom" />
      <div className="drum-window" />

      {phase === 'idle' && (
        <div className="winner-reveal" style={{ color: 'var(--text-dim)', animation: 'none', fontSize: 28 }}>
          Ready to draw
        </div>
      )}

      {phase === 'landed' && winnerName && (
        <div className="winner-reveal">{winnerName}</div>
      )}

      {phase !== 'idle' && (
        <div
          ref={stripRef}
          className="drum-strip"
          style={{ transform: `translateY(${transform}px)`, transition, visibility: phase === 'landed' ? 'hidden' : 'visible' }}
          onTransitionEnd={handleEnd}
        >
          {cells.map((name, i) => (
            <div
              key={i}
              className={`drum-cell ${i === cells.length - 1 ? 'winner-cell' : ''}`}
            >
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
