import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { BrandMark } from './Sphere';

const TABS = [
  { to: '/catalog', label: 'Catalog' },
  { to: '/library', label: 'Library' },
  { to: '/about', label: 'Story' },
];

export default function Layout({ user, onLogout, children }) {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="shell">
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <Link to="/" className="nav-brand">
          <BrandMark />
          musetheory
        </Link>
        <div className="nav-center">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} className={({ isActive }) => (isActive ? 'active' : '')}>
              {t.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-right">
          {user ? (
            <>
              <span className="nav-greet">
                Hi, {user.firstName || 'musician'}
                {user.instrumentName ? ` · ${user.instrumentName}` : ''}
              </span>
              <button className="btn btn-ghost btn-sm" onClick={onLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <Link to="/auth?mode=login" className="btn btn-text">
                Log in
              </Link>
              <button className="btn btn-lime btn-sm" onClick={() => navigate('/auth?mode=register')}>
                Get started
              </button>
            </>
          )}
        </div>
      </nav>

      <main className="shell-main">{children}</main>

      <footer className="footer">
        <span>Muse Theory · Frisco, TX</span>
        <span>Built by Pratham Aithal</span>
        <a href="https://github.com/Smashgod23/MuseTheory" target="_blank" rel="noreferrer">
          GitHub →
        </a>
      </footer>
    </div>
  );
}
