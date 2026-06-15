import { useEffect, useMemo, useState } from 'react';
import { fetchMatchesHtml, fetchRegistrationsHtml, ApiError } from '../api/client.js';
import { parseMatches, parseRegistrations } from '../parsers/ssi.js';
import { getUsername } from '../state/store.js';

const CREW_ONLY_KEY = 'tp.crewOnly';
const loadCrewOnly = () => localStorage.getItem(CREW_ONLY_KEY) !== '0'; // default true

export default function MatchSelect({ onSelect, onSignOut, onExpired }) {
  const [year, setYear] = useState(null); // null = current year
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [crewOnly, setCrewOnly] = useState(loadCrewOnly);

  function toggleCrewOnly(value) {
    setCrewOnly(value);
    localStorage.setItem(CREW_ONLY_KEY, value ? '1' : '0');
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');

    const jobs = [fetchMatchesHtml(year).then((r) => parseMatches(r.html))];
    if (!crewOnly) {
      jobs.push(
        fetchRegistrationsHtml(year)
          .then((r) => parseRegistrations(r.html))
          .catch(() => ({ matches: [], years: [], currentYear: null })) // non-fatal
      );
    }

    Promise.all(jobs)
      .then(([base, regs]) => {
        if (!alive) return;
        if (!regs) return setData(base);

        // Merge: organizer/staff matches win over competitor-only duplicates.
        const byUrl = new Map();
        base.matches.forEach((m) => byUrl.set(m.url, m));
        regs.matches.forEach((m) => byUrl.has(m.url) || byUrl.set(m.url, m));

        setData({
          matches: [...byUrl.values()].sort((a, b) => b.timestamp - a.timestamp),
          years: [...new Set([...base.years, ...regs.years])].sort((a, b) => b - a),
          currentYear: base.currentYear,
        });
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
  }, [year, crewOnly, onExpired]);

  const matches = data?.matches || [];
  const years = data?.years || [];
  const activeYear = year || data?.currentYear;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return matches;
    return matches.filter(
      (m) => m.name.toLowerCase().includes(q) || m.sport.toLowerCase().includes(q)
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
          <label className="checkrow" style={{ whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={crewOnly}
              onChange={(e) => toggleCrewOnly(e.target.checked)}
            />
            Only matches I crew or admin
          </label>
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
            are registered or listed as staff on SSI
            {crewOnly ? ', or switch off “Only matches I crew or admin”.' : '.'}
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="match-list">
            {filtered.map((m) => (
              <button key={m.url} className="match-row" onClick={() => onSelect(m)}>
                <div style={{ minWidth: 0 }}>
                  <div className="match-name">{m.name}</div>
                  <div className="match-meta">
                    {[m.dateText, m.sport, m.role, m.status].filter(Boolean).join(' · ')}
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
