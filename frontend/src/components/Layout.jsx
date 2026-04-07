import { NavLink } from 'react-router-dom';

export default function Layout({ children }) {
  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>EXPLOIT3RS</h1>
          <div className="subtitle">CTF Orchestrator</div>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" className={({ isActive }) => isActive ? 'active' : ''} end>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
            Dashboard
          </NavLink>
          <NavLink to="/create" className={({ isActive }) => isActive ? 'active' : ''}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="7" />
              <line x1="8" y1="4" x2="8" y2="12" />
              <line x1="4" y1="8" x2="12" y2="8" />
            </svg>
            Create Challenge
          </NavLink>
          <NavLink to="/?view=queue" className={() => ''}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
            Queue
          </NavLink>
          <NavLink to="/?view=packages" className={() => ''}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="4" width="12" height="10" rx="1" />
              <path d="M5 4V2h6v2" />
              <line x1="6" y1="8" x2="10" y2="8" />
            </svg>
            Packages
          </NavLink>
        </nav>
        <div style={{ padding: '16px', borderTop: '1px solid var(--border-color)', fontSize: '11px', color: 'var(--text-muted)' }}>
          v2.0.0 - Phase 2
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
