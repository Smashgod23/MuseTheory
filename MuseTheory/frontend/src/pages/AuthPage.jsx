import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { Sphere } from '../components/Sphere';

export default function AuthPage({ onAuthenticated }) {
  const [params] = useSearchParams();
  const initialMode = params.get('mode') === 'register' ? 'register' : 'login';
  const [mode, setMode] = useState(initialMode);
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
  const [instruments, setInstruments] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (mode !== 'register' || instruments.length > 0) return;
    api
      .listInstruments()
      .then((list) => setInstruments(list || []))
      .catch(() => setInstruments([]));
  }, [mode, instruments.length]);

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
        onAuthenticated(data.token);
        navigate('/catalog');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="auth-shell">
      <aside className="auth-art">
        <div className="eyebrow">A coaching workspace</div>
        <div className="auth-art-sphere">
          <Sphere />
        </div>
        <h2 className="auth-art-headline">
          Your repertoire,<br />on stage.
        </h2>
      </aside>

      <div className="auth-form-wrap">
        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>{mode === 'login' ? 'Welcome back.' : 'Join the early access.'}</h2>
          <p className="lede" style={{ fontSize: '0.95rem', marginTop: '0.35rem' }}>
            {mode === 'login'
              ? 'Sign in to pick up where you left off.'
              : 'Set up an account to save pieces, log practice, and unlock AI coaching.'}
          </p>

          <div className="auth-tabs">
            <button
              type="button"
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => setMode('login')}
            >
              Log in
            </button>
            <button
              type="button"
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => setMode('register')}
            >
              Register
            </button>
          </div>

          <div className="field">
            <label>Email</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={update('email')}
              required
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={update('password')}
              required
            />
          </div>

          {mode === 'register' && (
            <>
              <div className="grid-2" style={{ marginTop: '0.9rem' }}>
                <div className="field">
                  <label>First name</label>
                  <input value={form.firstName} onChange={update('firstName')} required />
                </div>
                <div className="field">
                  <label>Last name</label>
                  <input value={form.lastName} onChange={update('lastName')} required />
                </div>
              </div>

              <div className="grid-2" style={{ marginTop: '0.9rem' }}>
                <div className="field">
                  <label>Role</label>
                  <select value={form.role} onChange={update('role')}>
                    <option value="STUDENT">Student</option>
                    <option value="TEACHER">Teacher</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>
                <div className="field">
                  <label>Skill level</label>
                  <select value={form.skillLevel} onChange={update('skillLevel')}>
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginTop: '0.9rem' }}>
                <label>Instrument or voice part (optional)</label>
                <select value={form.instrumentId} onChange={update('instrumentId')}>
                  <option value="">Pick later</option>
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

          <button type="submit" className="btn btn-ink auth-submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>

          {error && <div className="error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
