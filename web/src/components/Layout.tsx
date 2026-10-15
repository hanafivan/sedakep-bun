import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import {
  IconDashboard,
  IconFileText,
  IconCalendarPlus,
  IconBriefcase,
  IconClock,
  IconCalendar,
  IconLayers,
  IconPieChart,
  IconHelpCircle,
  IconUser,
  IconInbox,
  IconCheckSquare,
  IconSettings,
  IconUsers,
  IconDatabase,
  IconSearch,
  IconBell,
} from './Icons';

type Role = 'verifikator' | 'atasan' | 'admin';

type MenuItem = {
  to: string;
  label: string;
  icon: (props: { size?: number }) => ReactNode;
  roles?: Role[];
};

type MenuGroup = {
  title: string;
  items: MenuItem[];
};

const menuGroups: MenuGroup[] = [
  {
    title: 'KERJA',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: IconDashboard },
      { to: '/leave', label: 'Permohonan', icon: IconFileText },
      { to: '/leave/new', label: 'Ajukan Cuti', icon: IconCalendarPlus },
      { to: '/assignments', label: 'Surat Tugas', icon: IconBriefcase },
      { to: '/alibi', label: 'Alibi', icon: IconClock },
      { to: '/agenda', label: 'Agenda', icon: IconCalendar },
      { to: '/incoming-letters', label: 'Surat Masuk', icon: IconInbox, roles: ['verifikator', 'atasan'] },
      { to: '/approvals', label: 'Approval', icon: IconCheckSquare, roles: ['verifikator', 'atasan'] },
    ],
  },
  {
    title: 'LAYANAN',
    items: [
      { to: '/services', label: 'Layanan', icon: IconLayers },
      { to: '/quota', label: 'Kuota', icon: IconPieChart },
      { to: '/leave/letters', label: 'Surat Keterangan', icon: IconFileText, roles: ['verifikator', 'atasan'] },
    ],
  },
  {
    title: 'AKUN',
    items: [
      { to: '/faq', label: 'FAQ Cuti', icon: IconHelpCircle },
      { to: '/profile', label: 'Profil', icon: IconUser },
      { to: '/admin/users', label: 'Pengguna', icon: IconUsers, roles: ['admin'] },
      { to: '/admin/master', label: 'Master Data', icon: IconDatabase, roles: ['admin'] },
      { to: '/admin/settings', label: 'Pengaturan', icon: IconSettings, roles: ['admin'] },
    ],
  },
];

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leave': 'Permohonan Cuti',
  '/leave/new': 'Ajukan Cuti',
  '/leave/letters': 'Surat Keterangan',
  '/assignments': 'Surat Tugas',
  '/assignments/new': 'Buat Surat Tugas',
  '/alibi': 'Alibi Pegawai',
  '/alibi/new': 'Ajukan Alibi',
  '/agenda': 'Agenda Kegiatan',
  '/agenda/new': 'Tambah Agenda',
  '/incoming-letters': 'Surat Masuk & Disposisi',
  '/approvals': 'Antrean Approval',
  '/services': 'Layanan Kepegawaian',
  '/services/new': 'Ajukan Layanan',
  '/quota': 'Saldo & Kuota',
  '/admin/users': 'Kelola Pengguna',
  '/admin/master': 'Master Data',
  '/admin/leave': 'Admin Cuti',
  '/admin/settings': 'Pengaturan',
  '/migration': 'Migrasi Data',
  '/profile': 'Profil Pegawai',
  '/faq': 'FAQ Cuti',
};

const getPageTitle = (pathname: string): string => {
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith('/leave/')) return 'Detail Cuti';
  if (pathname.startsWith('/assignments/')) return 'Detail Surat Tugas';
  if (pathname.startsWith('/alibi/')) return 'Detail Alibi';
  if (pathname.startsWith('/agenda/')) return 'Detail Agenda';
  if (pathname.startsWith('/services/')) return 'Detail Layanan';
  if (pathname.startsWith('/incoming-letters/')) return 'Detail Surat Masuk';
  return 'Layanan Kepegawaian';
};

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const canSee = (item: MenuItem): boolean => {
    if (!item.roles) return true;
    if (user?.role === 'admin') return true;
    return item.roles.includes(user?.role as Role);
  };

  const visibleGroups = menuGroups
    .map((group) => ({ ...group, items: group.items.filter(canSee) }))
    .filter((group) => group.items.length > 0);

  const initials = user?.name
    ? user.name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : 'P';

  const roleLabel =
    user?.role === 'admin'
      ? 'Administrator'
      : user?.role === 'atasan'
        ? 'Atasan Langsung'
        : user?.role === 'verifikator'
          ? 'Verifikator'
          : 'Pegawai';

  const currentTitle = getPageTitle(location.pathname);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/leave?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="app-shell">
      {/* Mobile Top Header */}
      <header className="mobile-header">
        <div className="mobile-header-brand">
          <div className="brand-logo-box small" aria-hidden="true">
            S
          </div>
          <span className="mobile-brand-title">Sedakep</span>
        </div>
        <button
          type="button"
          className="icon-touch-btn mobile-bell"
          aria-label="Notifikasi"
          title="Notifikasi"
        >
          <IconBell size={20} />
        </button>
      </header>

      {/* Desktop Sidebar (272px) */}
      <aside className="app-sidebar" aria-label="Menu Utama">
        <div className="sidebar-brand-area">
          <div className="brand-logo-box" aria-hidden="true">
            S
          </div>
          <div className="brand-titles">
            <strong className="brand-title">Sedakep</strong>
            <span className="brand-subtitle">PTSP Kemenag Sleman</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Navigasi Menu">
          {visibleGroups.map((group) => (
            <div className="nav-group-block" key={group.title}>
              <div className="nav-group-heading">{group.title}</div>
              <ul className="nav-group-list">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      className={({ isActive }) =>
                        isActive ? 'sidebar-menu-link active' : 'sidebar-menu-link'
                      }
                      aria-current={location.pathname === item.to ? 'page' : undefined}
                    >
                      <span className="menu-icon-wrap" aria-hidden="true">
                        {item.icon({ size: 20 })}
                      </span>
                      <span className="menu-label-text">{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-user-footer">
          <div className="sidebar-user-info">
            <div className="user-avatar-circle" aria-hidden="true">
              {initials}
            </div>
            <div className="user-text-meta">
              <span className="user-display-name" title={user?.name}>
                {user?.name || 'Pegawai'}
              </span>
              <span className="user-role-badge">{roleLabel}</span>
            </div>
          </div>
          <button
            className="sidebar-logout-btn"
            type="button"
            title="Keluar dari sistem"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            Keluar
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main-area">
        {/* Desktop Topbar (min-height 64px) */}
        <header className="app-topbar">
          <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
            <span className="crumb-root">PTSP Kemenag Sleman</span>
            <span className="crumb-divider" aria-hidden="true">/</span>
            <span className="crumb-active">{currentTitle}</span>
          </nav>

          <form className="topbar-search-form" onSubmit={handleSearchSubmit}>
            <label htmlFor="topbar-search-input" className="sr-only">
              Cari permohonan atau layanan
            </label>
            <div className="search-input-wrap">
              <IconSearch size={18} className="search-icon" aria-hidden="true" />
              <input
                id="topbar-search-input"
                type="search"
                className="topbar-search-input"
                placeholder="Cari permohonan atau layanan"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Cari permohonan atau layanan"
              />
            </div>
          </form>

          <div className="topbar-actions">
            <button
              type="button"
              className="icon-touch-btn"
              aria-label="Notifikasi"
              title="Notifikasi"
            >
              <IconBell size={20} />
            </button>

            <div className="topbar-profile-chip">
              <div className="user-avatar-circle" aria-hidden="true">
                {initials}
              </div>
              <div className="topbar-user-meta">
                <span className="topbar-user-name" title={user?.name}>
                  {user?.name || 'Pegawai'}
                </span>
                <span className="topbar-user-role">{roleLabel}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="app-page-content" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (5 Items: Dashboard, Permohonan, Cuti, Agenda, Profil) */}
      <nav className="mobile-bottom-nav" aria-label="Navigasi Cepat Mobile">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            isActive ? 'bottom-tab-link active' : 'bottom-tab-link'
          }
          aria-current={location.pathname === '/dashboard' ? 'page' : undefined}
        >
          <IconDashboard size={20} />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/leave"
          className={({ isActive }) =>
            isActive ? 'bottom-tab-link active' : 'bottom-tab-link'
          }
          aria-current={location.pathname === '/leave' ? 'page' : undefined}
        >
          <IconFileText size={20} />
          <span>Permohonan</span>
        </NavLink>

        <NavLink
          to="/leave/new"
          className={({ isActive }) =>
            isActive ? 'bottom-tab-link active' : 'bottom-tab-link'
          }
          aria-current={location.pathname === '/leave/new' ? 'page' : undefined}
        >
          <IconCalendarPlus size={20} />
          <span>Cuti</span>
        </NavLink>

        <NavLink
          to="/agenda"
          className={({ isActive }) =>
            isActive ? 'bottom-tab-link active' : 'bottom-tab-link'
          }
          aria-current={location.pathname === '/agenda' ? 'page' : undefined}
        >
          <IconCalendar size={20} />
          <span>Agenda</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            isActive ? 'bottom-tab-link active' : 'bottom-tab-link'
          }
          aria-current={location.pathname === '/profile' ? 'page' : undefined}
        >
          <IconUser size={20} />
          <span>Profil</span>
        </NavLink>
      </nav>
    </div>
  );
}

/** Pembungkus halaman umum untuk subhalaman yang belum diredesain */
export function Page({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
}) {
  return (
    <section className="page-container">
      <header className="page-head">
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** Kartu saldo kuota legacy compatibility */
export function QuotaCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: 'ok' | 'warn' | 'bad';
}) {
  return (
    <div className={`stat-card${tone ? ` ${tone}` : ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint ? <div className="stat-hint">{hint}</div> : null}
    </div>
  );
}
