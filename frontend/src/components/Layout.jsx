import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  Activity,
  BarChart3,
  Boxes,
  Calculator,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  QrCode,
  ScanLine,
  Shield,
  Sparkles,
  Users,
  UserCog,
  X,
  HeartPulse,
  ArrowLeftRight,
  Archive,
} from 'lucide-react';
import { useAuth } from '../auth';
import AssistantDock from './AssistantDock';

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', end: true, icon: LayoutDashboard, show: () => true },
      { to: '/activity', label: 'Activity', icon: Activity, show: () => true },
      { to: '/analytics', label: 'Analytics', icon: BarChart3, show: () => true },
    ],
  },
  {
    label: 'Assets',
    items: [
      { to: '/assets', label: 'Asset register', icon: Boxes, show: () => true },
      { to: '/scan', label: 'Scan / handover', icon: QrCode, show: (a) => a.isStaff },
      { to: '/employees', label: 'Employees', icon: Users, show: () => true },
      { to: '/invoice', label: 'Invoice intake', icon: FileText, show: (a) => a.isStaff },
    ],
  },
  {
    label: 'Workflows',
    items: [
      { to: '/allocations', label: 'Allocations', icon: ScanLine, show: () => true },
      { to: '/transfers', label: 'Transfers', icon: ArrowLeftRight, show: () => true },
      { to: '/retirements', label: 'Retirements', icon: Archive, show: () => true },
      { to: '/approvals', label: 'Approvals', icon: ClipboardCheck, show: (a) => a.isApprover },
    ],
  },
  {
    label: 'Reports',
    items: [
      { to: '/reports', label: 'NBV reports', icon: FileText, show: () => true },
      { to: '/npv', label: 'NPV calculator', icon: Calculator, show: () => true },
      { to: '/device-health', label: 'Device health', icon: HeartPulse, show: () => true },
      { to: '/assistant', label: 'Assistant', icon: Sparkles, show: () => true },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/users', label: 'Users', icon: UserCog, show: (a) => a.isAdmin },
    ],
  },
];

export default function Layout() {
  const auth = useAuth();
  const { user, logout } = auth;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.show(auth)),
  })).filter((section) => section.items.length > 0);

  return (
    <div className={`shell ${collapsed ? 'shell-collapsed' : ''}`}>
      {mobileOpen ? (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Shield size={18} strokeWidth={2.25} />
          </span>
          <div className="brand-copy">
            <strong>TrackSphere</strong>
            <p>Asset management</p>
          </div>
          <button
            type="button"
            className="icon-btn sidebar-close"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="nav" onClick={() => setMobileOpen(false)}>
          {sections.map((section) => (
            <div key={section.label} className="nav-section">
              <p className="nav-section-label">{section.label}</p>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                    title={item.label}
                  >
                    <Icon size={18} strokeWidth={1.9} aria-hidden="true" />
                    <span className="nav-link-text">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <div className="user-chip">
            <div className="user-avatar" aria-hidden="true">
              {(user?.displayName || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="user-meta">
              <strong>{user?.displayName || user?.email}</strong>
              <span className={`badge badge-role badge-${String(user?.role || '').toLowerCase()}`}>
                {user?.role}
              </span>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-block" onClick={logout}>
            <LogOut size={16} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button
            type="button"
            className="icon-btn mobile-only"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            className="icon-btn desktop-only"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            onClick={() => setCollapsed((v) => !v)}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="topbar-brand mobile-only">
            <strong>TrackSphere</strong>
          </div>
          <div className="topbar-spacer" />
          <span className="topbar-role muted small desktop-only">{user?.role}</span>
        </div>
        <div className="main-content">
          <Outlet />
        </div>
        <AssistantDock />
      </div>
    </div>
  );
}
