import { useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';
import CatalogPanel from './panels/CatalogPanel';
import LibraryPanel from './panels/LibraryPanel';

const TABS = [
  { id: 'catalog', label: 'Catalog' },
  { id: 'library', label: 'My library' },
  { id: 'tools', label: 'API tools' },
];

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('catalog');
  const [libraryRefresh, setLibraryRefresh] = useState(0);

  useEffect(() => {
    setToken(token);
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    api.me()
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) setTokenState(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="container">
      <header className="app-header">
        <div className="app-title">
          <h1>MuseTheory</h1>
          <span className="status">AI music coaching workspace</span>
        </div>
        <AuthBar token={token} user={user} onTokenChange={setTokenState} />
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'catalog' && (
        <CatalogPanel
          token={token}
          user={user}
          onSaved={() => setLibraryRefresh((n) => n + 1)}
        />
      )}
      {tab === 'library' && <LibraryPanel token={token} refreshKey={libraryRefresh} />}
      {tab === 'tools' && <ToolsPanel token={token} onTokenChange={setTokenState} />}
    </div>
  );
}

function AuthBar({ token, user, onTokenChange }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'STUDENT',
    skillLevel: 'BEGINNER',
    instrumentId: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);
  const [instruments, setInstruments] = useState([]);

  useEffect(() => {
    if (!open || mode !== 'register' || instruments.length > 0) return;
    api.listInstruments()
      .then((list) => setInstruments(list || []))
      .catch(() => setInstruments([]));
  }, [open, mode, instruments.length]);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let data;
      if (mode === 'login') {
        data = await api.login({ email: form.email, password: form.password });
      } else {
        const payload = { ...form };
        if (!payload.instrumentId) delete payload.instrumentId;
        data = await api.register(payload);
      }
      if (data?.token) {
        onTokenChange(data.token);
        setOpen(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (token) {
    const greeting = user?.firstName
      ? `Welcome, ${user.firstName}${user.instrumentName ? ` (${user.instrumentName})` : ''}`
      : 'Signed in';
    return (
      <div className="auth-bar">
        <span className="success">{greeting}</span>
        <button
          className="secondary"
          onClick={() => {
            onTokenChange(null);
          }}
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar">
      {!open && (
        <button onClick={() => setOpen(true)}>Log in / Register</button>
      )}
      {open && (
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="row">
            <button
              type="button"
              className={`tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={`tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>
          <div className="row">
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          {mode === 'register' && (
            <>
              <div className="row">
                <input
                  placeholder="First name"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
                <input
                  placeholder="Last name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
              <div className="row">
                <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  <option value="STUDENT">Student</option>
                  <option value="TEACHER">Teacher</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <select
                  value={form.skillLevel}
                  onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}
                >
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <div className="row">
                <select
                  value={form.instrumentId}
                  onChange={(e) => setForm({ ...form, instrumentId: e.target.value })}
                  style={{ flex: 1 }}
                >
                  <option value="">Instrument or voice part (optional)</option>
                  {instruments.filter((i) => i.type !== 'voice').length > 0 && (
                    <optgroup label="Instruments">
                      {instruments
                        .filter((i) => i.type !== 'voice')
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                  {instruments.filter((i) => i.type === 'voice').length > 0 && (
                    <optgroup label="Voice parts">
                      {instruments
                        .filter((i) => i.type === 'voice')
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </>
          )}
          <div className="row">
            <button type="submit" disabled={busy}>
              {busy ? '...' : mode === 'login' ? 'Log in' : 'Register'}
            </button>
            <button type="button" className="secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
          </div>
          {error && <div className="error">{error}</div>}
        </form>
      )}
    </div>
  );
}

function ToolsPanel({ token }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const [instrumentForm, setInstrumentForm] = useState({
    name: '',
    type: 'string',
    rangeLow: '',
    rangeHigh: '',
  });
  const [voicePartForm, setVoicePartForm] = useState({
    name: '',
    rangeLow: '',
    rangeHigh: '',
  });

  async function run(label, fn) {
    setLoading(true);
    setError(null);
    setResult({ label, data: 'loading...' });
    try {
      const data = await fn();
      setResult({ label, data });
    } catch (e) {
      setError(`${label}: ${e.message}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInstrument(e) {
    e.preventDefault();
    await run('POST /api/instruments', () =>
      api.createInstrument({
        name: instrumentForm.name,
        type: instrumentForm.type,
        rangeLow: instrumentForm.rangeLow || null,
        rangeHigh: instrumentForm.rangeHigh || null,
      })
    );
  }

  async function handleCreateVoicePart(e) {
    e.preventDefault();
    await run('POST /api/instruments/voice-parts', () =>
      api.createVoicePart({
        name: voicePartForm.name,
        rangeLow: voicePartForm.rangeLow || null,
        rangeHigh: voicePartForm.rangeHigh || null,
      })
    );
  }

  return (
    <div>
      <div className="card">
        <h2>Public endpoints</h2>
        <div className="row">
          <button onClick={() => run('GET /api/instruments', api.listInstruments)} disabled={loading}>
            List instruments
          </button>
          <button onClick={() => run('GET /api/instruments/voice-parts', api.listVoiceParts)} disabled={loading}>
            List voice parts
          </button>
          <button onClick={() => run('GET /api/pieces', api.listPieces)} disabled={loading}>
            List pieces
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Add instrument</h2>
        <form onSubmit={handleCreateInstrument}>
          <div className="row">
            <input
              placeholder="Name (e.g. Viola)"
              value={instrumentForm.name}
              onChange={(e) => setInstrumentForm({ ...instrumentForm, name: e.target.value })}
              required
            />
            <select
              value={instrumentForm.type}
              onChange={(e) => setInstrumentForm({ ...instrumentForm, type: e.target.value })}
            >
              <option value="string">string</option>
              <option value="woodwind">woodwind</option>
              <option value="brass">brass</option>
              <option value="keyboard">keyboard</option>
              <option value="percussion">percussion</option>
              <option value="voice">voice</option>
            </select>
          </div>
          <div className="row">
            <input
              placeholder="Range low (e.g. C3)"
              value={instrumentForm.rangeLow}
              onChange={(e) => setInstrumentForm({ ...instrumentForm, rangeLow: e.target.value })}
            />
            <input
              placeholder="Range high (e.g. E6)"
              value={instrumentForm.rangeHigh}
              onChange={(e) => setInstrumentForm({ ...instrumentForm, rangeHigh: e.target.value })}
            />
            <button type="submit" disabled={loading || !token}>
              Add instrument
            </button>
          </div>
        </form>
        {!token && <div className="status">Log in to create instruments.</div>}
      </div>

      <div className="card">
        <h2>Add voice part</h2>
        <form onSubmit={handleCreateVoicePart}>
          <div className="row">
            <input
              placeholder="Name (e.g. Mezzo-Soprano)"
              value={voicePartForm.name}
              onChange={(e) => setVoicePartForm({ ...voicePartForm, name: e.target.value })}
              required
            />
          </div>
          <div className="row">
            <input
              placeholder="Range low"
              value={voicePartForm.rangeLow}
              onChange={(e) => setVoicePartForm({ ...voicePartForm, rangeLow: e.target.value })}
            />
            <input
              placeholder="Range high"
              value={voicePartForm.rangeHigh}
              onChange={(e) => setVoicePartForm({ ...voicePartForm, rangeHigh: e.target.value })}
            />
            <button type="submit" disabled={loading || !token}>
              Add voice part
            </button>
          </div>
        </form>
        {!token && <div className="status">Log in to create voice parts.</div>}
      </div>

      <div className="card">
        <h2>Authenticated endpoints</h2>
        <div className="row">
          <button onClick={() => run('GET /api/users/me', api.me)} disabled={loading || !token}>
            Get current user
          </button>
        </div>
        {!token && <div className="status">Log in to enable these.</div>}
      </div>

      <div className="card">
        <h2>Response</h2>
        {error && <div className="error">{error}</div>}
        {result && (
          <>
            <div className="status">{result.label}</div>
            <pre>{JSON.stringify(result.data, null, 2)}</pre>
          </>
        )}
        {!result && !error && <div className="status">No request made yet.</div>}
      </div>
    </div>
  );
}
