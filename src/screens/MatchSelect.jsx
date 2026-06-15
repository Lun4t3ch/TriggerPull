import { useEffect, useMemo, useState } from 'react';
import { fetchMatchesHtml, ApiError } from '../api/client.js';
import { parseMatches } from '../parsers/ssi.js';
import { getUsername } from '../state/store.js';

export default function MatchSelect({ onSelect, onSignOut, onExpired }) {
  const [year, setYear] = useState(null); // null = current year
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    fetchMatchesHtml(year)
      .then(({ html }) => {
        if (!alive) return;
        setData(parseMatches(html));
      })
      .catch((err) => {
        if (!alive) return;
        if (err instanceof ApiError && err.expired) return onExpired();
        setError(err.message || 'Could not load your competitions.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [year, onExpired]);

  const matches = data?.matches || [];
  const years = data?.years || [];
  const activeYear = year || data?.currentYear;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.sport.toLowerCase().includes(q)
    );
  }, [matches, query]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="wordmark">
          Trigger<span className="tp-accent">Pull</span>
        </div>
        <div className="row-gap" style={{ alignItems: 'center' }}>
          <span className="topbar-sub">{getUsername()}</span>
          <button className="btn btn-ghost" onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <div className="container">
        <h2 style={{ marginTop: 0 }}>Choose a competition</h2>

        <div className="toolbar">
          <input
            className="input"
            placeholder="Search by name or sport…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {years.length > 0 && (
          <div className="year-nav" style={{ marginBottom: 18 }}>
            {years.map((y) => (
              <button
                key={y}
                className={`chip ${y === activeYear ? 'active' : ''}`}
                onClick={() => setYear(y)}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        {loading && (
          <div className="loading-wrap">
            <span className="spinner" /> Loading your competitions…
          </div>
        )}

        {error && !loading && (
          <div className="card">
            <div className="error-msg">{error}</div>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => setYear((y) => y)}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="card muted">
            No matches found. If you expect to see matches here, make sure you
            are registered or listed as staff on SSI.
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="match-list">
            {filtered.map((m) => (
              <button key={m.url} className="match-row" onClick={() => onSelect(m)}>
                <div style={{ minWidth: 0 }}>
                  <div className="match-name">{m.name}</div>
                  <div className="match-meta">
                    {m.dateText} · {m.sport}
                    {m.role ? ` · ${m.role}` : ''}
                    {m.status ? ` · ${m.status}` : ''}
                  </div>
                </div>
                {m.registered != null && (
                  <div className="match-count">
                    {m.registered}
                    {m.capacity != null ? `/${m.capacity}` : ''}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
