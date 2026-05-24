import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { api, getToken, setToken } from './api';
import Layout from './components/Layout';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import CatalogPage from './pages/CatalogPage';
import LibraryPage from './pages/LibraryPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  const [token, setTokenState] = useState(getToken());
  const [user, setUser] = useState(null);
  const [libraryRefresh, setLibraryRefresh] = useState(0);

  useEffect(() => {
    setToken(token);
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    api
      .me()
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
    <BrowserRouter>
      <Layout user={user} onLogout={() => setTokenState(null)}>
        <Routes>
          <Route path="/" element={<LandingPage user={user} />} />
          <Route
            path="/auth"
            element={
              token ? <Navigate to="/catalog" replace /> : <AuthPage onAuthenticated={setTokenState} />
            }
          />
          <Route
            path="/catalog"
            element={
              <CatalogPage
                token={token}
                user={user}
                onSaved={() => setLibraryRefresh((n) => n + 1)}
              />
            }
          />
          <Route
            path="/library"
            element={<LibraryPage token={token} refreshKey={libraryRefresh} />}
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
