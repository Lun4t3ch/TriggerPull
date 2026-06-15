import { useState } from 'react';

const STATUS_LABEL = { CLAIMED: 'Claimed', NOT_PRESENT: 'Not present' };

function csvEscape(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function Export({ matchName, winners, onBack }) {
  const [copied, setCopied] = useState(false);
  const timestamp = new Date().toLocaleString();

  const rows = winners.map((w) => [w.drawNo, w.name, STATUS_LABEL[w.outcome] || w.outcome]);

  async function copy() {
    const tsv = ['Draw\tName\tStatus', ...rows.map((r) => r.join('\t'))].join('\n');
    try {
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  function downloadCsv() {
    const csv = ['Draw,Name,Status', ...rows.map((r) => r.map(csvEscape).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safe = (matchName || 'prize-draw').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    a.href = url;
    a.download = `${safe}-draw.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="overlay" onClick={onBack}>
      <div className="dialog" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <h3>{matchName}</h3>
        <div className="muted" style={{ marginBottom: 14 }}>Exported {timestamp}</div>

        {winners.length === 0 ? (
          <p className="muted">No draws completed yet.</p>
        ) : (
          <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
            <table className="export-table">
              <thead>
                <tr><th>Draw</th><th>Name</th><th>Status</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="num">#{r[0]}</td>
                    <td>{r[1]}</td>
                    <td>{r[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
          <button className="btn btn-ghost" onClick={onBack}>Back to draw</button>
          <div className="row-gap">
            <button className="btn" onClick={copy} disabled={winners.length === 0}>
              {copied ? 'Copied!' : 'Copy to clipboard'}
            </button>
            <button className="btn btn-primary" onClick={downloadCsv} disabled={winners.length === 0}>
              Download CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
