import { useState } from 'react';
import Login from './screens/Login.jsx';
import MatchSelect from './screens/MatchSelect.jsx';
import ParticipantReview from './screens/ParticipantReview.jsx';
import Draw from './screens/Draw.jsx';
import { getSession, clearSession, findResumableDraw } from './state/store.js';

const SCREEN = { LOGIN: 'LOGIN', MATCH: 'MATCH', REVIEW: 'REVIEW', DRAW: 'DRAW' };

export default function App() {
  const [screen, setScreen] = useState(() => (getSession() ? SCREEN.MATCH : SCREEN.LOGIN));
  const [match, setMatch] = useState(null);
  const [entrants, setEntrants] = useState([]);
  const [resumeDraw, setResumeDraw] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [resumePrompt, setResumePrompt] = useState(() =>
    getSession() ? findResumableDraw() : null
  );

  function handleSignedIn() {
    setLoginMessage('');
    setResumePrompt(findResumableDraw());
    setScreen(SCREEN.MATCH);
  }

  function handleSignOut() {
    clearSession();
    setMatch(null);
    setEntrants([]);
    setResumeDraw(false);
    setResumePrompt(null);
    setScreen(SCREEN.LOGIN);
  }

  function handleExpired() {
    clearSession();
    setMatch(null);
    setResumePrompt(null);
    setLoginMessage('Your session expired, please sign in again.');
    setScreen(SCREEN.LOGIN);
  }

  function selectMatch(m) {
    setMatch(m);
    setResumeDraw(false);
    setScreen(SCREEN.REVIEW);
  }

  function startDraw(builtEntrants) {
    setEntrants(builtEntrants);
    setResumeDraw(false);
    setScreen(SCREEN.DRAW);
  }

  function resumeSavedDraw() {
    const saved = resumePrompt;
    if (!saved?.match) return setResumePrompt(null);
    setMatch(saved.match);
    setEntrants([]);
    setResumeDraw(true);
    setResumePrompt(null);
    setScreen(SCREEN.DRAW);
  }

  return (
    <>
      {screen === SCREEN.LOGIN && (
        <Login initialMessage={loginMessage} onSignedIn={handleSignedIn} />
      )}

      {screen === SCREEN.MATCH && (
        <MatchSelect onSelect={selectMatch} onSignOut={handleSignOut} onExpired={handleExpired} />
      )}

      {screen === SCREEN.REVIEW && match && (
        <ParticipantReview
          match={match}
          onStartDraw={startDraw}
          onBack={() => setScreen(SCREEN.MATCH)}
          onSignOut={handleSignOut}
          onExpired={handleExpired}
        />
      )}

      {screen === SCREEN.DRAW && match && (
        <Draw
          match={match}
          initialEntrants={entrants}
          resume={resumeDraw}
          onBackToMatches={() => setScreen(SCREEN.MATCH)}
          onSignOut={handleSignOut}
        />
      )}

      {resumePrompt && screen === SCREEN.MATCH && (
        <div className="overlay" onClick={() => setResumePrompt(null)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Resume draw?</h3>
            <p className="muted">
              {resumePrompt.match?.name} — {(resumePrompt.winners || []).length} draws completed
            </p>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setResumePrompt(null)}>
                Start new session
              </button>
              <button className="btn btn-primary" onClick={resumeSavedDraw}>
                Resume
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
