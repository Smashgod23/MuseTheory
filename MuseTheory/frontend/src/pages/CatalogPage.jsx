import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { formatDuration } from '../format';

const ENSEMBLE_OPTIONS = [
  { value: '',          label: 'Any ensemble' },
  { value: 'vocal',     label: 'Vocal' },
  { value: 'choir',     label: 'Choir' },
  { value: 'voice',     label: 'Solo voice' },
  { value: 'opera',     label: 'Opera' },
  { value: 'orchestra', label: 'Orchestra' },
  { value: 'chamber',   label: 'Chamber' },
  { value: 'band',      label: 'Band' },
  { value: 'solo',      label: 'Solo instr.' },
];

export default function CatalogPage({ token, user, onSaved }) {
  const [filters, setFilters] = useState({
    q: '',
    ensembleType: '',
    style: '',
    language: '',
    instrument: '',
    difficultyMin: '',
    difficultyMax: '',
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savedMap, setSavedMap] = useState(null);

  useEffect(() => {
    if (!token) {
      setSavedMap(null);
      return;
    }
    api
      .listRepertoire()
      .then((entries) => {
        const m = new Map();
        (entries || []).forEach((e) => m.set(e.piece.id, e.id));
        setSavedMap(m);
      })
      .catch(() => setSavedMap(new Map()));
  }, [token]);

  useEffect(() => {
    runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userInstrument = user?.instrumentName || '';
  useEffect(() => {
    setFilters((prev) => {
      if (prev.instrument === userInstrument) return prev;
      const next = { ...prev, instrument: userInstrument };
      runSearchWith(next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userInstrument]);

  async function runSearchWith(f) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.searchPieces(f);
      setResults(data || []);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch(e) {
    if (e) e.preventDefault();
    await runSearchWith(filters);
  }

  function clearInstrumentFilter() {
    const next = { ...filters, instrument: '' };
    setFilters(next);
    runSearchWith(next);
  }

  async function openDetail(id) {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await api.getPiece(id);
      setDetail(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
  }

  async function toggleSave(piece) {
    if (!token || !savedMap) return;
    const entryId = savedMap.get(piece.id);

    if (entryId) {
      if (typeof entryId === 'string' && entryId.startsWith('pending-')) return;
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.delete(piece.id);
        return next;
      });
      try {
        await api.deleteRepertoire(entryId);
      } catch {
        setSavedMap((prev) => {
          const next = new Map(prev);
          next.set(piece.id, entryId);
          return next;
        });
      }
    } else {
      const tempId = `pending-${piece.id}`;
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.set(piece.id, tempId);
        return next;
      });
      try {
        const entry = await api.saveRepertoire({ pieceId: piece.id, status: 'NEW' });
        setSavedMap((prev) => {
          const next = new Map(prev);
          next.set(piece.id, entry.id);
          return next;
        });
        if (onSaved) onSaved();
      } catch {
        setSavedMap((prev) => {
          const next = new Map(prev);
          next.delete(piece.id);
          return next;
        });
      }
    }
  }

  const isSaved = detail && savedMap?.has(detail.id);
  const activeChips = Object.entries(filters).filter(([k, v]) => v && k !== 'q');

  return (
    <div className="section-pad-tight" style={{ paddingTop: '2.5rem' }}>
      <header style={{ marginBottom: '1.5rem' }}>
        <div className="eyebrow" style={{ marginBottom: '0.5rem' }}>Browse the catalog</div>
        <h1 className="display display-md" style={{ marginBottom: '0.65rem' }}>
          Find your next piece.
        </h1>
        <p className="lede" style={{ maxWidth: '54ch' }}>
          Search by title, composer, ensemble, language, or difficulty. Save anything that
          catches your ear to your library and start practicing.
        </p>
      </header>

      <form onSubmit={runSearch}>
        <div className="toolbar">
          <input
            placeholder="Search title, composer, arranger…"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
          <select
            value={filters.ensembleType}
            onChange={(e) => setFilters({ ...filters, ensembleType: e.target.value })}
          >
            {ENSEMBLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <input
            placeholder="Style"
            value={filters.style}
            onChange={(e) => setFilters({ ...filters, style: e.target.value })}
          />
          <input
            placeholder="Language"
            value={filters.language}
            onChange={(e) => setFilters({ ...filters, language: e.target.value })}
          />
          <input
            placeholder="Difficulty"
            type="number"
            min="1"
            max="10"
            value={filters.difficultyMin}
            onChange={(e) => setFilters({ ...filters, difficultyMin: e.target.value })}
          />
          <button type="submit" className="btn btn-ink" disabled={loading}>
            {loading ? '…' : 'Search'}
          </button>
        </div>
      </form>

      {(filters.instrument || activeChips.length > 0) && (
        <div className="chip-row">
          {filters.instrument && (
            <span className="chip chip-active">
              Personalized: {filters.instrument}
              <button type="button" onClick={clearInstrumentFilter}>×</button>
            </span>
          )}
          {activeChips
            .filter(([k]) => k !== 'instrument')
            .map(([k, v]) => (
              <span className="chip" key={k}>
                {k}: {v}
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...filters, [k]: '' };
                    setFilters(next);
                    runSearchWith(next);
                  }}
                >
                  ×
                </button>
              </span>
            ))}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      {selectedId && (
        <div className="piece-detail">
          {detailLoading && <div className="status">Loading piece…</div>}
          {detail && (
            <>
              <div>
                <h2 className="piece-detail-title">{detail.title}</h2>
                {detail.alternateTitle && (
                  <div className="piece-detail-alt">a.k.a. {detail.alternateTitle}</div>
                )}
                <div className="piece-detail-meta">
                  <strong>{detail.composer || 'Unknown composer'}</strong>
                  {detail.arranger && <span> · arr. {detail.arranger}</span>}
                </div>
                {detail.performanceNotes && (
                  <div className="piece-detail-notes">
                    <h4>Performance notes</h4>
                    <p>{detail.performanceNotes}</p>
                  </div>
                )}
                {(detail.sheetMusicUrl || detail.scoreUrl || detail.midiRefUrl) && (
                  <div className="piece-detail-links">
                    {detail.sheetMusicUrl && (
                      <a href={detail.sheetMusicUrl} target="_blank" rel="noreferrer">Sheet music →</a>
                    )}
                    {detail.scoreUrl && (
                      <a href={detail.scoreUrl} target="_blank" rel="noreferrer">Score →</a>
                    )}
                    {detail.midiRefUrl && (
                      <a href={detail.midiRefUrl} target="_blank" rel="noreferrer">MIDI ref →</a>
                    )}
                  </div>
                )}
              </div>
              <div>
                <dl className="piece-detail-grid">
                  <Field label="Ensemble" value={detail.ensembleType} />
                  <Field label="Instrumentation" value={detail.instrumentation} />
                  <Field label="Genre" value={detail.genre} />
                  <Field label="Difficulty" value={detail.difficultyLevel} />
                  <Field label="Language" value={detail.language} />
                  <Field label="Key" value={detail.musicalKey} />
                  <Field label="Era" value={detail.era} />
                  <Field
                    label="Duration"
                    value={detail.durationSeconds != null ? formatDuration(detail.durationSeconds) : null}
                  />
                  <Field label="Purpose" value={detail.purpose} />
                  <Field label="Source" value={detail.sourceReference} />
                </dl>
                <div className="row" style={{ marginTop: '1rem' }}>
                  {token ? (
                    <button
                      className={`btn ${isSaved ? 'btn-ghost' : 'btn-lime'}`}
                      onClick={() => toggleSave(detail)}
                    >
                      {isSaved ? 'Remove from library' : 'Save to library'}
                    </button>
                  ) : (
                    <Link to="/auth?mode=login" className="btn btn-lime">
                      Log in to save
                    </Link>
                  )}
                  <button className="btn btn-text" onClick={closeDetail}>Close</button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div style={{ marginTop: '2rem', marginBottom: '1rem' }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="display display-md" style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.25rem)' }}>
            Results <span className="status" style={{ marginLeft: '0.75rem' }}>{results.length} pieces</span>
          </h2>
        </div>
      </div>

      {results.length === 0 && !loading && (
        <div className="card" style={{ textAlign: 'center', color: 'var(--muted)' }}>
          No pieces matched. Try broadening your search.
        </div>
      )}

      <div className="piece-grid">
        {results.map((p) => (
          <PieceCard
            key={p.id}
            piece={p}
            onClick={() => openDetail(p.id)}
            active={selectedId === p.id}
            token={token}
            savedMap={savedMap}
            onToggleSave={toggleSave}
          />
        ))}
      </div>
    </div>
  );
}

function PieceCard({ piece, onClick, active, token, savedMap, onToggleSave }) {
  const isSaved = savedMap?.has(piece.id);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className={`piece-card ${active ? 'active' : ''}`}
    >
      <div className="piece-card-header">
        <h3 className="piece-card-title">{piece.title}</h3>
        {token && savedMap !== null && (
          <button
            type="button"
            className={`piece-card-save ${isSaved ? 'saved' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSave(piece); }}
            onKeyDown={(e) => e.stopPropagation()}
            title={isSaved ? 'Remove from library' : 'Save to library'}
            aria-label={isSaved ? 'Remove from library' : 'Save to library'}
          >
            {isSaved ? '★' : '+'}
          </button>
        )}
      </div>
      {piece.alternateTitle && <div className="piece-card-alt">a.k.a. {piece.alternateTitle}</div>}
      <div className="piece-card-meta">
        {piece.composer || 'Unknown composer'}
        {piece.arranger ? ` · arr. ${piece.arranger}` : ''}
      </div>
      <div className="piece-card-tags">
        {piece.ensembleType && <span className="tag">{piece.ensembleType}</span>}
        {piece.genre && <span className="tag">{piece.genre}</span>}
        {piece.difficultyLevel != null && (
          <span className="tag tag-lime">diff {piece.difficultyLevel}</span>
        )}
        {piece.language && <span className="tag">{piece.language}</span>}
        {piece.musicalKey && <span className="tag">{piece.musicalKey}</span>}
        {piece.durationSeconds != null && (
          <span className="tag">{formatDuration(piece.durationSeconds)}</span>
        )}
      </div>
      {piece.instrumentation && (
        <div className="piece-card-instrumentation">{piece.instrumentation}</div>
      )}
      {piece.performanceNotes && (
        <div className="piece-card-notes">
          {piece.performanceNotes.length > 140
            ? `${piece.performanceNotes.slice(0, 140)}…`
            : piece.performanceNotes}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

export { PieceCard };

export function PieceDetailInline({ piece }) {
  return (
    <div>
      <h2 className="piece-detail-title">{piece.title}</h2>
      {piece.alternateTitle && (
        <div className="piece-detail-alt">a.k.a. {piece.alternateTitle}</div>
      )}
      <div className="piece-detail-meta">
        <strong>{piece.composer || 'Unknown composer'}</strong>
        {piece.arranger && <span> · arr. {piece.arranger}</span>}
      </div>
      <dl className="piece-detail-grid">
        <Field label="Ensemble" value={piece.ensembleType} />
        <Field label="Instrumentation" value={piece.instrumentation} />
        <Field label="Genre" value={piece.genre} />
        <Field label="Difficulty" value={piece.difficultyLevel} />
        <Field label="Language" value={piece.language} />
        <Field label="Key" value={piece.musicalKey} />
        <Field label="Era" value={piece.era} />
        <Field
          label="Duration"
          value={piece.durationSeconds != null ? formatDuration(piece.durationSeconds) : null}
        />
        <Field label="Purpose" value={piece.purpose} />
        <Field label="Source" value={piece.sourceReference} />
      </dl>
      {piece.performanceNotes && (
        <div className="piece-detail-notes">
          <h4>Performance notes</h4>
          <p>{piece.performanceNotes}</p>
        </div>
      )}
      {(piece.sheetMusicUrl || piece.scoreUrl || piece.midiRefUrl) && (
        <div className="piece-detail-links">
          {piece.sheetMusicUrl && (
            <a href={piece.sheetMusicUrl} target="_blank" rel="noreferrer">Sheet music →</a>
          )}
          {piece.scoreUrl && (
            <a href={piece.scoreUrl} target="_blank" rel="noreferrer">Score →</a>
          )}
          {piece.midiRefUrl && (
            <a href={piece.midiRefUrl} target="_blank" rel="noreferrer">MIDI ref →</a>
          )}
        </div>
      )}
    </div>
  );
}
