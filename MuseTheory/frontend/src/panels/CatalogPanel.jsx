import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDuration } from '../format';

const ENSEMBLE_OPTIONS = ['', 'choir', 'band', 'orchestra', 'chamber', 'solo'];

export default function CatalogPanel({ token, onSaved }) {
  const [filters, setFilters] = useState({
    q: '',
    ensembleType: '',
    style: '',
    language: '',
    difficultyMin: '',
    difficultyMax: '',
  });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Map of pieceId -> repertoire entry id for the logged-in user.
  // null means not yet loaded; empty Map means loaded but nothing saved.
  const [savedMap, setSavedMap] = useState(null);

  // Load the user's saved pieces whenever auth state changes.
  useEffect(() => {
    if (!token) {
      setSavedMap(null);
      return;
    }
    api.listRepertoire()
      .then((entries) => {
        const m = new Map();
        (entries || []).forEach((e) => m.set(e.piece.id, e.id));
        setSavedMap(m);
      })
      .catch(() => setSavedMap(new Map()));
  }, [token]);

  useEffect(() => {
    runSearch();
    // run initial catalog load once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSearch(e) {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.searchPieces(filters);
      setResults(data || []);
    } catch (err) {
      setError(err.message);
      setResults([]);
    } finally {
      setLoading(false);
    }
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

  // Toggle save/unsave for a piece. Optimistic update so the UI responds instantly.
  async function toggleSave(piece) {
    if (!token || !savedMap) return;

    const entryId = savedMap.get(piece.id);

    if (entryId) {
      // Unsave: remove immediately then confirm with server
      setSavedMap((prev) => {
        const next = new Map(prev);
        next.delete(piece.id);
        return next;
      });
      try {
        await api.deleteRepertoire(entryId);
      } catch {
        // rollback on failure
        setSavedMap((prev) => {
          const next = new Map(prev);
          next.set(piece.id, entryId);
          return next;
        });
      }
    } else {
      // Save: mark as saved immediately, then update with real entry id
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
        // rollback on failure
        setSavedMap((prev) => {
          const next = new Map(prev);
          next.delete(piece.id);
          return next;
        });
      }
    }
  }

  const isSaved = detail && savedMap?.has(detail.id);

  return (
    <div>
      <div className="card">
        <h2>Search repertoire</h2>
        <form onSubmit={runSearch}>
          <div className="row">
            <input
              placeholder="Title, alternate title, composer, or arranger"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              style={{ flex: 2 }}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
          <div className="row">
            <select
              value={filters.ensembleType}
              onChange={(e) => setFilters({ ...filters, ensembleType: e.target.value })}
            >
              {ENSEMBLE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt || 'Any ensemble'}
                </option>
              ))}
            </select>
            <input
              placeholder="Style / genre"
              value={filters.style}
              onChange={(e) => setFilters({ ...filters, style: e.target.value })}
            />
            <input
              placeholder="Language"
              value={filters.language}
              onChange={(e) => setFilters({ ...filters, language: e.target.value })}
            />
            <input
              placeholder="Min diff."
              type="number"
              min="1"
              max="10"
              value={filters.difficultyMin}
              onChange={(e) => setFilters({ ...filters, difficultyMin: e.target.value })}
              style={{ maxWidth: '110px' }}
            />
            <input
              placeholder="Max diff."
              type="number"
              min="1"
              max="10"
              value={filters.difficultyMax}
              onChange={(e) => setFilters({ ...filters, difficultyMax: e.target.value })}
              style={{ maxWidth: '110px' }}
            />
          </div>
        </form>
        {error && <div className="error">{error}</div>}
      </div>

      {selectedId && (
        <div className="card">
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <h2 style={{ margin: 0 }}>Piece detail</h2>
            <button className="secondary" onClick={closeDetail}>
              Close
            </button>
          </div>
          {detailLoading && <div className="status">Loading...</div>}
          {detail && <PieceDetail piece={detail} />}
          {detail && token && (
            <div className="row" style={{ marginTop: '1rem' }}>
              <button
                className={isSaved ? 'secondary' : ''}
                onClick={() => toggleSave(detail)}
              >
                {isSaved ? 'Remove from my library' : 'Save to my library'}
              </button>
              {isSaved && (
                <span className="status" style={{ alignSelf: 'center' }}>
                  Saved to your library
                </span>
              )}
            </div>
          )}
          {detail && !token && (
            <div className="status" style={{ marginTop: '0.75rem' }}>
              Log in to save this to your library.
            </div>
          )}
        </div>
      )}

      <div className="card">
        <h2>
          Results <span className="status">({results.length})</span>
        </h2>
        {results.length === 0 && !loading && (
          <div className="status">No pieces matched. Try broadening your search.</div>
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
        <div className="piece-card-title">{piece.title}</div>
        {token && (
          <button
            type="button"
            className={`piece-card-save ${isSaved ? 'saved' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleSave(piece); }}
            title={isSaved ? 'Remove from library' : 'Save to library'}
          >
            {isSaved ? '★' : '☆'}
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
        {piece.difficultyLevel != null && <span className="tag">diff {piece.difficultyLevel}</span>}
        {piece.language && <span className="tag">{piece.language}</span>}
        {piece.musicalKey && <span className="tag">{piece.musicalKey}</span>}
        {piece.durationSeconds != null && <span className="tag">{formatDuration(piece.durationSeconds)}</span>}
      </div>
      {piece.instrumentation && <div className="piece-card-instrumentation">{piece.instrumentation}</div>}
      {piece.performanceNotes && (
        <div className="piece-card-notes">
          {piece.performanceNotes.length > 140
            ? `${piece.performanceNotes.slice(0, 140)}...`
            : piece.performanceNotes}
        </div>
      )}
    </div>
  );
}

export function PieceDetail({ piece }) {
  return (
    <div className="piece-detail">
      <h3 className="piece-detail-title">{piece.title}</h3>
      {piece.alternateTitle && <div className="piece-detail-alt">a.k.a. {piece.alternateTitle}</div>}
      <div className="piece-detail-meta">
        <strong>{piece.composer || 'Unknown composer'}</strong>
        {piece.arranger && <span> · arranged by {piece.arranger}</span>}
      </div>
      <dl className="piece-detail-grid">
        <Field label="Ensemble" value={piece.ensembleType} />
        <Field label="Instrumentation" value={piece.instrumentation} />
        <Field label="Style / genre" value={piece.genre} />
        <Field label="Difficulty" value={piece.difficultyLevel} />
        <Field label="Language" value={piece.language} />
        <Field label="Key / mode" value={piece.musicalKey} />
        <Field label="Era" value={piece.era} />
        <Field label="Duration" value={piece.durationSeconds != null ? formatDuration(piece.durationSeconds) : null} />
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
            <a href={piece.sheetMusicUrl} target="_blank" rel="noreferrer">
              Sheet music
            </a>
          )}
          {piece.scoreUrl && (
            <a href={piece.scoreUrl} target="_blank" rel="noreferrer">
              Score
            </a>
          )}
          {piece.midiRefUrl && (
            <a href={piece.midiRefUrl} target="_blank" rel="noreferrer">
              MIDI reference
            </a>
          )}
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
