import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/assets', label: 'Assets' },
  { to: '/allocations', label: 'Allocations' },
  { to: '/transfers', label: 'Transfers' },
  { to: '/retirements', label: 'Retirements' },
  { to: '/approvals', label: 'Approvals' },
  { to: '/rfid', label: 'RFID Scan' },
  { to: '/agents', label: 'Edge Agents' },
  { to: '/analytics', label: 'Analytics' },
];

export default function Layout() {
  const { user, logout } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">TS</span>
          <div>
            <strong>TrackSphere</strong>
            <p>Asset Management</p>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <p className="muted">{user?.displayName || user?.email}</p>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
