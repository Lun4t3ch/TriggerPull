import { useMemo, useRef, useState } from 'react';
import {
  ACCEPT,
  readSheets,
  bestSheet,
  detectColumns,
  columnLabel,
  buildNames,
  toParticipants,
  listId,
} from '../parsers/file.js';
import UploadHelp from '../components/UploadHelp.jsx';

const PREVIEW = 8;

export default function Import({ onImported, onBack, backLabel }) {
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(-1); // -1 = no header row
  const [detectedHeader, setDetectedHeader] = useState(0);
  const [nameCols, setNameCols] = useState([0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  async function load(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const parsed = await readSheets(file);
      if (!parsed.length) throw new Error('empty');
      setSheets(parsed);
      setFileName(file.name);
      selectSheet(parsed, bestSheet(parsed));
    } catch {
      setSheets(null);
      setError('Could not read any names from that file. Use an Excel file (.xlsx) or a CSV with one person per row.');
    } finally {
      setBusy(false);
    }
  }

  // Switch sheet and re-run the column guess for it.
  function selectSheet(list, i) {
    const guess = detectColumns(list[i].rows);
    setSheetIdx(i);
    setHeaderRow(guess.headerRow);
    setDetectedHeader(Math.max(0, guess.headerRow));
    setNameCols(guess.nameCols);
  }

  const rows = sheets?.[sheetIdx]?.rows || null;
  const names = useMemo(
    () => (rows ? buildNames(rows, { headerRow, nameCols }) : []),
    [rows, headerRow, nameCols]
  );
  const duplicates = names.length - new Set(names.map((n) => n.toLowerCase())).size;
  const width = rows ? Math.max(...rows.map((r) => r.length)) : 0;

  function setCol(slot, value) {
    const next = [...nameCols];
    if (value === '') next.splice(slot, 1);
    else next[slot] = Number(value);
    setNameCols(next);
  }

  function continueToReview() {
    const base = fileName.replace(/\.[^.]+$/, '') || 'Imported list';
    onImported({
      match: {
        source: 'file',
        id: listId(fileName, names),
        name: base,
        url: null,
        dateText: `Imported from ${fileName}`,
        sport: '',
      },
      participants: toParticipants(names),
    });
  }

  return (
    <div className="container container-narrow" style={{ paddingTop: 48 }}>
      <div className="center" style={{ marginBottom: 28 }}>
        <div className="wordmark" style={{ fontSize: 34 }}>
          Trigger<span className="tp-accent">Pull</span>
        </div>
        <div className="muted" style={{ marginTop: 6 }}>Draw from your own list</div>
      </div>

      <div className="card">
        <h2 style={{ marginTop: 0, fontSize: 21 }}>Upload a participant list</h2>

        <div
          className={`dropzone ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            load(e.dataTransfer.files?.[0]);
          }}
        >
          {busy ? (
            <span className="spinner" />
          ) : (
            <>
              <strong>{fileName || 'Choose a file'}</strong>
              <span className="muted">
                {fileName ? 'Tap to choose another file' : 'or drop it here · Excel (.xlsx, .xls) or CSV'}
              </span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            hidden
            onChange={(e) => {
              load(e.target.files?.[0]);
              e.target.value = ''; // allow picking the same file again
            }}
          />
        </div>

        {error && <div className="error-msg" style={{ marginTop: 12 }}>{error}</div>}

        <UploadHelp />

        {rows && (
          <>
            {sheets.length > 1 && (
              <div className="field" style={{ marginTop: 18, marginBottom: 0 }}>
                <label className="label" htmlFor="sh">Sheet</label>
                <select id="sh" className="input" value={sheetIdx} onChange={(e) => selectSheet(sheets, Number(e.target.value))}>
                  {sheets.map((sh, i) => (
                    <option key={i} value={i}>{sh.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="import-cols">
              <div className="field">
                <label className="label" htmlFor="c1">Name from</label>
                <select id="c1" className="input" value={nameCols[0]} onChange={(e) => setCol(0, e.target.value)}>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>{columnLabel(rows, i, headerRow)}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn-ghost swap"
                title="Swap name order"
                disabled={nameCols.length < 2}
                onClick={() => setNameCols([nameCols[1], nameCols[0]])}
              >
                ⇄
              </button>
              <div className="field">
                <label className="label" htmlFor="c2">+ column (optional)</label>
                <select id="c2" className="input" value={nameCols[1] ?? ''} onChange={(e) => setCol(1, e.target.value)}>
                  <option value="">— none —</option>
                  {Array.from({ length: width }, (_, i) => (
                    <option key={i} value={i}>{columnLabel(rows, i, headerRow)}</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="checkrow" style={{ marginBottom: 16 }}>
              <input
                type="checkbox"
                checked={headerRow >= 0}
                onChange={(e) => setHeaderRow(e.target.checked ? detectedHeader : -1)}
              />
              {headerRow > 0 ? 'Has a header row (title rows above it are skipped)' : 'First row is a header'}
            </label>

            <div className="label">Preview</div>
            <div className="import-preview">
              {names.slice(0, PREVIEW).map((n, i) => (
                <div key={i}>{n}</div>
              ))}
              {names.length > PREVIEW && <div className="muted">… and {names.length - PREVIEW} more</div>}
            </div>
            <div className="muted" style={{ margin: '10px 0 18px' }}>
              {names.length} names found
              {duplicates > 0 && ` · ${duplicates} duplicate${duplicates > 1 ? 's' : ''} (you can untick them on the next screen)`}
            </div>

            <button
              className="btn btn-primary btn-block btn-lg"
              disabled={names.length === 0}
              onClick={continueToReview}
            >
              Continue →
            </button>
          </>
        )}

        <div className="disclaimer" style={{ marginTop: 20 }}>
          <strong>The file never leaves your device.</strong> It is read in your
          browser and the list is only stored locally so a draw can be resumed.
        </div>
      </div>

      <div className="center" style={{ marginTop: 18 }}>
        <button className="btn btn-ghost" onClick={onBack}>{backLabel}</button>
      </div>
    </div>
  );
}
