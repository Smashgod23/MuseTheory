import { useEffect, useState } from 'react';
import { api } from '../api';
import { formatDateTime, formatDuration, formatStatus } from '../format';
import { PieceDetail } from './CatalogPanel';

const STATUS_OPTIONS = ['NEW', 'LEARNING', 'POLISHING', 'PERFORMANCE_READY'];

export default function LibraryPanel({ token, refreshKey }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (token) loadEntries();
    else setEntries([]);
    // refreshKey changes after CatalogPanel saves a new entry
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshKey]);

  async function loadEntries() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listRepertoire();
      setEntries(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="card">
        <h2>My library</h2>
        <div className="status">Log in to see and manage your repertoire.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>My repertoire</h2>
          <button className="secondary" onClick={loadEntries} disabled={loading}>
            Refresh
          </button>
        </div>
        {error && <div className="error">{error}</div>}
        {entries.length === 0 && !loading && (
          <div className="status">
            Nothing here yet. Head to the Catalog tab and save a piece to get started.
          </div>
        )}
        <div className="entry-list">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              active={selectedId === entry.id}
              onClick={() => setSelectedId(selectedId === entry.id ? null : entry.id)}
            />
          ))}
        </div>
      </div>

      {selectedId && (
        <EntryDetail
          entryId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={() => {
            setSelectedId(null);
            loadEntries();
          }}
          onUpdated={loadEntries}
        />
      )}
    </div>
  );
}

function EntryRow({ entry, active, onClick }) {
  const piece = entry.piece || {};
  return (
    <button type="button" onClick={onClick} className={`entry-row ${active ? 'active' : ''}`}>
      <div className="entry-row-main">
        <div className="entry-row-title">{piece.title}</div>
        <div className="entry-row-sub">
          {piece.composer || 'Unknown composer'}
          {piece.arranger ? ` · arr. ${piece.arranger}` : ''}
        </div>
      </div>
      <div className="entry-row-side">
        <span className={`badge badge-${entry.status.toLowerCase()}`}>{formatStatus(entry.status)}</span>
        <div className="entry-row-updated">Updated {formatDateTime(entry.updatedAt)}</div>
      </div>
    </button>
  );
}

function EntryDetail({ entryId, onClose, onDeleted, onUpdated }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [statusDraft, setStatusDraft] = useState('NEW');
  const [goalsDraft, setGoalsDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const [practiceForm, setPracticeForm] = useState({ durationMinutes: '', notes: '' });
  const [practiceError, setPracticeError] = useState(null);
  const [loggingPractice, setLoggingPractice] = useState(false);

  useEffect(() => {
    loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  async function loadDetail() {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getRepertoireDetail(entryId);
      setDetail(data);
      setStatusDraft(data.entry.status);
      setGoalsDraft(data.entry.goals || '');
      setNotesDraft(data.entry.notes || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry() {
    setSaving(true);
    setSaveError(null);
    setSavedAt(null);
    try {
      await api.updateRepertoire(entryId, {
        status: statusDraft,
        goals: goalsDraft,
        notes: notesDraft,
      });
      setSavedAt(new Date());
      onUpdated?.();
      await loadDetail();
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry() {
    if (!window.confirm('Remove this piece from your repertoire?')) return;
    try {
      await api.deleteRepertoire(entryId);
      onDeleted?.();
    } catch (err) {
      setError(err.message);
    }
  }

  async function logPractice(e) {
    e.preventDefault();
    setPracticeError(null);
    setLoggingPractice(true);
    try {
      const payload = {
        durationMinutes: Number(practiceForm.durationMinutes),
        notes: practiceForm.notes || null,
      };
      await api.logPractice(entryId, payload);
      setPracticeForm({ durationMinutes: '', notes: '' });
      await loadDetail();
    } catch (err) {
      setPracticeError(err.message);
    } finally {
      setLoggingPractice(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h2 style={{ margin: 0 }}>Practice workspace</h2>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>

      {loading && <div className="status">Loading...</div>}
      {error && <div className="error">{error}</div>}

      {detail && (
        <>
          <PieceDetail piece={detail.entry.piece} />

          <div className="section">
            <h3>Status, goals, notes</h3>
            <div className="row">
              <select value={statusDraft} onChange={(e) => setStatusDraft(e.target.value)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {formatStatus(s)}
                  </option>
                ))}
              </select>
              <button onClick={saveEntry} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button className="secondary" onClick={deleteEntry}>
                Remove from repertoire
              </button>
            </div>
            <textarea
              placeholder="Practice goals (e.g. clean up measure 40, memorize B section by Friday)"
              value={goalsDraft}
              onChange={(e) => setGoalsDraft(e.target.value)}
              rows={3}
            />
            <textarea
              placeholder="Personal notes"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={3}
            />
            {saveError && <div className="error">{saveError}</div>}
            {savedAt && <div className="success">Saved {savedAt.toLocaleTimeString()}.</div>}
          </div>

          <div className="section">
            <h3>Log a practice session</h3>
            <form onSubmit={logPractice}>
              <div className="row">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  placeholder="Duration (minutes)"
                  value={practiceForm.durationMinutes}
                  onChange={(e) => setPracticeForm({ ...practiceForm, durationMinutes: e.target.value })}
                  required
                />
                <input
                  placeholder="What did you work on?"
                  value={practiceForm.notes}
                  onChange={(e) => setPracticeForm({ ...practiceForm, notes: e.target.value })}
                  style={{ flex: 2 }}
                />
                <button type="submit" disabled={loggingPractice}>
                  {loggingPractice ? 'Logging...' : 'Log session'}
                </button>
              </div>
            </form>
            {practiceError && <div className="error">{practiceError}</div>}
          </div>

          <div className="section">
            <h3>Practice history ({detail.practiceSessions.length})</h3>
            {detail.practiceSessions.length === 0 && (
              <div className="status">No practice logged for this piece yet.</div>
            )}
            <ul className="log-list">
              {detail.practiceSessions.map((s) => (
                <li key={s.id}>
                  <div className="log-main">
                    <strong>{s.durationMinutes} min</strong>
                    {s.notes && <span className="log-notes"> — {s.notes}</span>}
                  </div>
                  <div className="log-date">{formatDateTime(s.practicedAt)}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="section">
            <h3>Recordings ({detail.performances.length})</h3>
            {detail.performances.length === 0 && (
              <div className="status">
                No recordings uploaded for this piece yet. Use the performance upload flow to add one.
              </div>
            )}
            <ul className="log-list">
              {detail.performances.map((p) => (
                <li key={p.id}>
                  <div className="log-main">
                    <strong>Performance</strong>
                    {p.durationSeconds != null && <span> · {formatDuration(p.durationSeconds)}</span>}
                  </div>
                  <div className="log-date">{formatDateTime(p.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>

          <div className="section">
            <h3>Feedback history ({detail.feedback.length})</h3>
            {detail.feedback.length === 0 && (
              <div className="status">No feedback yet. Feedback appears here after a recording is analyzed.</div>
            )}
            <ul className="log-list">
              {detail.feedback.map((f) => (
                <li key={f.id}>
                  <div className="log-main">
                    <strong>{f.source}</strong>
                    {f.featureTargeted && <span> · {f.featureTargeted}</span>}
                    {f.musicalityScore != null && <span> · score {f.musicalityScore}</span>}
                    {f.suggestionText && <div className="log-notes">{f.suggestionText}</div>}
                  </div>
                  <div className="log-date">{formatDateTime(f.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
