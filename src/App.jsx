import { useCallback, useState } from 'react';
import Login from './screens/Login.jsx';
import MatchSelect from './screens/MatchSelect.jsx';
import Import from './screens/Import.jsx';
import ParticipantReview from './screens/ParticipantReview.jsx';
import Draw from './screens/Draw.jsx';
import { getSession, clearSession, findResumableDraw } from './state/store.js';

const SCREEN = { LOGIN: 'LOGIN', MATCH: 'MATCH', IMPORT: 'IMPORT', REVIEW: 'REVIEW', DRAW: 'DRAW' };

const isFile = (m) => m?.source === 'file';

// Signed out, only file-based draws can be resumed (SSI ones need a session).
function resumable() {
  return getSession() ? findResumableDraw() : findResumableDraw((d) => isFile(d.match));
}

export default function App() {
  const [screen, setScreen] = useState(() => (getSession() ? SCREEN.MATCH : SCREEN.LOGIN));
  const [match, setMatch] = useState(null);
  const [imported, setImported] = useState([]); // participants from an uploaded file
  const [entrants, setEntrants] = useState([]);
  const [resumeDraw, setResumeDraw] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');
  const [resumePrompt, setResumePrompt] = useState(resumable);

  // "Home" is the competition list when signed in, the sign-in page otherwise.
  function goHome() {
    setScreen(getSession() ? SCREEN.MATCH : SCREEN.LOGIN);
  }

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

  // Stable identity: screens list it as an effect dependency, so a new
  // function every render would re-fetch from SSI on every App update.
  const handleExpired = useCallback(() => {
    clearSession();
    setMatch(null);
    setResumePrompt(null);
    setLoginMessage('Your session expired, please sign in again.');
    setScreen(SCREEN.LOGIN);
  }, []);

  function selectMatch(m) {
    setMatch(m);
    setResumeDraw(false);
    setScreen(SCREEN.REVIEW);
  }

  function handleImported({ match: m, participants }) {
    setImported(participants);
    selectMatch(m);
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

  const signedIn = Boolean(getSession());
  const fileMode = isFile(match);

  return (
    <>
      {screen === SCREEN.LOGIN && (
        <Login
          initialMessage={loginMessage}
          onSignedIn={handleSignedIn}
          onUseFile={() => setScreen(SCREEN.IMPORT)}
        />
      )}

      {screen === SCREEN.MATCH && (
        <MatchSelect
          onSelect={selectMatch}
          onSignOut={handleSignOut}
          onExpired={handleExpired}
          onUseFile={() => setScreen(SCREEN.IMPORT)}
        />
      )}

      {screen === SCREEN.IMPORT && (
        <Import
          onImported={handleImported}
          onBack={goHome}
          backLabel={signedIn ? '← Back to competitions' : '← Back to sign in'}
        />
      )}

      {screen === SCREEN.REVIEW && match && (
        <ParticipantReview
          match={match}
          initialParticipants={fileMode ? imported : null}
          onStartDraw={startDraw}
          onBack={() => setScreen(fileMode ? SCREEN.IMPORT : SCREEN.MATCH)}
          onSignOut={signedIn ? handleSignOut : null}
          onExpired={handleExpired}
        />
      )}

      {screen === SCREEN.DRAW && match && (
        <Draw
          match={match}
          initialEntrants={entrants}
          resume={resumeDraw}
          backLabel={fileMode && !signedIn ? 'Back to start' : 'Back to matches'}
          onBackToMatches={goHome}
          onSignOut={signedIn ? handleSignOut : null}
        />
      )}

      {resumePrompt && (screen === SCREEN.MATCH || screen === SCREEN.LOGIN) && (
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
