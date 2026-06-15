import { useState } from 'react';
import { login } from '../api/client.js';
import { saveSession } from '../state/store.js';
import { ApiError } from '../api/client.js';

export default function Login({ initialMessage, onSignedIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialMessage || '');

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      const { sessionid } = await login(username, password);
      saveSession(sessionid, remember, username);
      onSignedIn();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Something went wrong. Please try again.'
      );
      setBusy(false);
    }
  }

  return (
    <div className="container container-narrow" style={{ paddingTop: 48 }}>
      <div className="center" style={{ marginBottom: 28 }}>
        <div className="wordmark" style={{ fontSize: 34 }}>
          Trigger<span className="tp-accent">Pull</span>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>
          Prize draws for shooting competitions
        </div>
      </div>

      <form className="card" onSubmit={submit}>
        <h2 style={{ marginTop: 0, fontSize: 21 }}>
          Sign in with your Shoot’n Score It account
        </h2>

        <div className="field">
          <label className="label" htmlFor="u">Username</label>
          <input
            id="u"
            className="input"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="label" htmlFor="p">Password</label>
          <input
            id="p"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <label className="checkrow" style={{ marginBottom: 18 }}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember me on this device
        </label>

        <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
          {busy ? <span className="spinner" /> : 'Sign in'}
        </button>

        {error && <div className="error-msg center" style={{ marginTop: 14 }}>{error}</div>}

        <div className="disclaimer" style={{ marginTop: 20 }}>
          <strong>Your password is never visible to TriggerPull.</strong> Your
          credentials are sent directly to Shoot’n Score It’s servers using the
          same login process as their website. TriggerPull only stores your
          session token (not your password) to keep you logged in during this
          session.
        </div>
      </form>
    </div>
  );
}
