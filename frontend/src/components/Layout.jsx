import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth';
import { useState } from 'react';

export default function Layout() {
  const { user, logout, isAdmin, isStaff, isApprover } = useAuth();
  const [open, setOpen] = useState(false);

  const NAV = [
    { to: '/', label: 'Dashboard', end: true, show: true },
    { to: '/assets', label: 'Assets', show: true },
    { to: '/scan', label: 'Scan / Handover', show: isStaff },
    { to: '/reports', label: 'Reports', show: true },
    { to: '/allocations', label: 'Allocations', show: true },
    { to: '/transfers', label: 'Transfers', show: true },
    { to: '/retirements', label: 'Retirements', show: true },
    { to: '/approvals', label: 'Approvals', show: isApprover },
    { to: '/employees', label: 'Employees', show: true },
    { to: '/users', label: 'Users', show: isAdmin },
    { to: '/invoice', label: 'Invoice intake', show: isStaff },
    { to: '/assistant', label: 'Assistant', show: true },
    { to: '/device-health', label: 'Device health', show: true },
    { to: '/activity', label: 'Activity', show: true },
    { to: '/analytics', label: 'Analytics', show: true },
    { to: '/npv', label: 'NPV calculator', show: true },
  ].filter((i) => i.show);

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand">
          <span className="brand-mark">TS</span>
          <div>
            <strong>TrackSphere</strong>
            <p>Asset Management</p>
          </div>
          <button type="button" className="nav-toggle" onClick={() => setOpen((v) => !v)}>
            Menu
          </button>
        </div>
        <nav className="nav" onClick={() => setOpen(false)}>
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
          <p className="muted">
            {user?.displayName || user?.email}
            <br />
            <span className="badge badge-in_use">{user?.role}</span>
          </p>
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
