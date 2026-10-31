import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import * as api from '../api';
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
  IconMenu,
  IconX,
  IconLogOut,
  IconCreditCard,
  IconHistory,
  IconBuilding,
  IconUserCheck,
  IconVideo,
} from './Icons';

type Role = 'verifikator' | 'atasan' | 'admin';
type BadgeKind = 'disposition' | 'leave' | 'quota';

type MenuItem = {
  to: string;
  label: string;
  icon: (props: { size?: number }) => ReactNode;
  /** Peran tambahan di luar `pegawai`; admin selalu boleh. */
  roles?: Role[];
  /** Item berbahaya — teks kemerahan. */
  danger?: boolean;
  badge?: BadgeKind;
  activeWhen?: (pathname: string, params: URLSearchParams) => boolean;
};

type MenuGroup = { title: string; items: MenuItem[] };

const pathMatches = (pathname: string, to: string) => {
  const base = to.split('?')[0];
  return pathname === base || pathname.startsWith(`${base}/`);
};

/**
 * Definisi menu sidebar per peran. Urutan dan label mengikuti spesifikasi.
 * Semua `to` memakai route yang sudah ada.
 */
const menuGroups: MenuGroup[] = [
  {
    title: 'Utama',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: IconDashboard }],
  },
  {
    title: 'Cuti',
    items: [
      {
        to: '/leave',
        label: 'Permohonan Cuti',
        icon: IconFileText,
        badge: 'leave',
        activeWhen: (pathname) =>
          pathMatches(pathname, '/leave') ||
          pathMatches(pathname, '/leave/history') ||
          pathMatches(pathname, '/approvals') ||
          pathMatches(pathname, '/leave/letters'),
      },
      { to: '/quota', label: 'Buku Kuota Cuti', icon: IconPieChart, badge: 'quota' },
      { to: '/faq', label: 'FAQ Cuti', icon: IconHelpCircle },
    ],
  },
  {
    title: 'Kinerja',
    items: [
      {
        to: '/incoming-letters',
        label: 'Disposisi',
        icon: IconInbox,
        roles: ['verifikator', 'atasan'],
        badge: 'disposition',
      },
      { to: '/assignments', label: 'Surat Tugas', icon: IconBriefcase },
      { to: '/alibi', label: 'Alibi', icon: IconClock },
      { to: '/agenda', label: 'Agenda', icon: IconCalendar },
    ],
  },
  {
    title: 'Layanan',
    items: [
      {
        to: '/services',
        label: 'Layanan Kepegawaian',
        icon: IconLayers,
        activeWhen: (pathname, params) =>
          pathMatches(pathname, '/services') && params.get('type') !== 'bpjs',
      },
      {
        to: '/services?type=bpjs',
        label: 'Kartu BPJS',
        icon: IconCreditCard,
        activeWhen: (pathname, params) =>
          pathMatches(pathname, '/services') && params.get('type') === 'bpjs',
      },
      { to: '/riwayat', label: 'Riwayat Pengajuan', icon: IconHistory },
    ],
  },
  {
    title: 'Admin',
    items: [
      { to: '/admin/settings', label: 'Instansi', icon: IconBuilding, roles: ['admin'] },
      { to: '/admin/users', label: 'Pengguna', icon: IconUsers, roles: ['admin'] },
      {
        to: '/admin/leave',
        label: 'Pengaturan Kuota Cuti',
        icon: IconSettings,
        roles: ['admin'],
        activeWhen: (pathname, params) =>
          pathMatches(pathname, '/admin/leave') && params.get('tab') !== 'pppk',
      },
      {
        to: '/admin/leave?tab=pppk',
        label: 'Validasi TMT PPPK',
        icon: IconUserCheck,
        roles: ['admin'],
        activeWhen: (pathname, params) =>
          pathMatches(pathname, '/admin/leave') && params.get('tab') === 'pppk',
      },
      { to: '/admin/backup', label: 'Backup & Restore', icon: IconDatabase, roles: ['admin'], danger: true },
    ],
  },
  {
    title: 'Bantuan',
    items: [
      { to: '/panduan/pdf', label: 'Panduan PDF', icon: IconFileText },
      { to: '/panduan/video', label: 'Panduan Video', icon: IconVideo },
    ],
  },
];

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/leave': 'Permohonan Cuti',
  '/leave/new': 'Ajukan Cuti',
  '/leave/history': 'Riwayat & Persetujuan',
  '/leave/letters': 'Riwayat & Persetujuan',
  '/assignments': 'Surat Tugas',
  '/assignments/new': 'Buat Surat Tugas',
  '/alibi': 'Alibi Pegawai',
  '/alibi/new': 'Ajukan Alibi',
  '/agenda': 'Agenda Kegiatan',
  '/agenda/new': 'Tambah Agenda',
  '/incoming-letters': 'Disposisi',
  '/approvals': 'Riwayat & Persetujuan',
  '/services': 'Layanan Kepegawaian',
  '/services/new': 'Ajukan Layanan',
  '/riwayat': 'Riwayat Pengajuan',
  '/quota': 'Kuota Cuti',
  '/admin/users': 'Pengguna',
  '/admin/master': 'Master Data',
  '/admin/leave': 'Pengaturan Kuota Cuti',
  '/admin/settings': 'Instansi',
  '/admin/backup': 'Backup & Restore',
  '/panduan/pdf': 'Panduan PDF',
  '/panduan/video': 'Panduan Video',
  '/migration': 'Migrasi Data',
  '/profile': 'Profil Pegawai',
  '/faq': 'FAQ Cuti',
};

const getPageTitle = (pathname: string, params: URLSearchParams): string => {
  if (pathname === '/admin/leave' && params.get('tab') === 'pppk') return 'Validasi TMT PPPK';
  if (ROUTE_LABELS[pathname]) return ROUTE_LABELS[pathname];
  if (pathname.startsWith('/leave/')) return 'Detail Cuti';
  if (pathname.startsWith('/assignments/')) return 'Detail Surat Tugas';
  if (pathname.startsWith('/alibi/')) return 'Detail Alibi';
  if (pathname.startsWith('/agenda/')) return 'Detail Agenda';
  if (pathname.startsWith('/services/')) return 'Detail Layanan';
  if (pathname.startsWith('/incoming-letters/')) return 'Detail Surat Masuk';
  return 'Layanan Kepegawaian';
};

const roleLabelOf = (role: string | undefined): string => {
  if (role === 'admin') return 'Super Admin';
  if (role === 'atasan' || role === 'verifikator') return 'Atasan';
  return 'Pegawai';
};

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [searchQuery, setSearchQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [badges, setBadges] = useState<api.NavigationBadges | null>(null);

  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

  const canSee = (item: MenuItem): boolean => {
    if (!item.roles) return true;
    if (user?.role === 'admin') return true;
    return item.roles.includes(user?.role as Role);
  };

  const visibleGroups = menuGroups
    .map((group) => ({ ...group, items: group.items.filter(canSee) }))
    .filter((group) => group.items.length > 0);

  const visibleItems = visibleGroups.flatMap((group) => group.items);

  const isActive = (item: MenuItem): boolean =>
    item.activeWhen ? item.activeWhen(location.pathname, params) : pathMatches(location.pathname, item.to);

  const badgeValue = (kind?: BadgeKind): number => {
    if (!badges || !kind) return 0;
    if (kind === 'disposition') return badges.disposition_pending;
    if (kind === 'leave') return badges.leave_pending;
    return badges.quota_remaining_days;
  };

  const badgeSrText = (kind: BadgeKind, value: number): string => {
    if (kind === 'disposition') return `${value} belum diproses`;
    if (kind === 'leave') return `${value} menunggu`;
    return `${value} hari tersisa`;
  };

  const roleLabel = roleLabelOf(user?.role);
  const currentTitle = getPageTitle(location.pathname, params);
  const notifCount = (badges?.disposition_pending ?? 0) + (badges?.leave_pending ?? 0);

  // Angka badge selalu dari server; disegarkan setiap kali rute berubah.
  useEffect(() => {
    let alive = true;
    if (!user) return;
    api
      .getNavigationBadges()
      .then((value) => {
        if (alive) setBadges(value);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user, location.pathname, location.search]);

  // Tutup drawer & popover notifikasi saat pindah halaman.
  useEffect(() => {
    setDrawerOpen(false);
    setNotifOpen(false);
  }, [location.pathname, location.search]);

  // Esc menutup drawer dan mengembalikan fokus ke tombol hamburger.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        hamburgerRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  // Fokus masuk ke tombol tutup ketika drawer dibuka.
  useEffect(() => {
    if (drawerOpen) closeBtnRef.current?.focus();
  }, [drawerOpen]);

  // Kunci scroll body selama drawer terbuka.
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  const closeDrawer = () => {
    setDrawerOpen(false);
    hamburgerRef.current?.focus();
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const query = searchQuery.trim();
    if (query) navigate(`/leave?search=${encodeURIComponent(query)}`);
  };

  const searchTargets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const targets: Array<{ to: string; label: string }> = [];
    if (query) {
      for (const item of visibleItems) {
        if (item.label.toLowerCase().includes(query)) {
          targets.push({ to: item.to, label: `Menu · ${item.label}` });
        }
      }
      targets.push({ to: `/leave?search=${encodeURIComponent(searchQuery.trim())}`, label: 'Permohonan · cari di daftar cuti' });
      targets.push({ to: `/services?search=${encodeURIComponent(searchQuery.trim())}`, label: 'Layanan · cari di daftar permohonan' });
      if (user?.role === 'admin') {
        targets.push({ to: `/admin/users?search=${encodeURIComponent(searchQuery.trim())}`, label: 'Pengguna · cari pegawai' });
      }
    }
    return targets.slice(0, 8);
  }, [searchQuery, visibleItems, user?.role]);

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Loncat ke konten utama
      </a>
      {/* Overlay drawer (mobile) */}
      {drawerOpen ? (
        <button
          type="button"
          className="sidebar-overlay"
          aria-label="Tutup menu"
          tabIndex={-1}
          onClick={closeDrawer}
        />
      ) : null}

      {/* Sidebar (desktop tetap, mobile drawer) */}
      <aside
        id="app-sidebar"
        className={`app-sidebar${drawerOpen ? ' drawer-open' : ''}`}
        aria-label="Menu utama"
      >
        <div className="sidebar-brand-area">
          <div className="brand-logo-box" aria-hidden="true">
            S
          </div>
          <div className="brand-titles">
            <strong className="brand-title">Sedakep</strong>
            <span className="brand-subtitle">PTSP Kemenag Sleman</span>
          </div>
          <button
            ref={closeBtnRef}
            type="button"
            className="sidebar-close-btn"
            aria-label="Tutup menu"
            onClick={closeDrawer}
          >
            <IconX size={20} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Navigasi utama">
          {visibleGroups.map((group) => (
            <div className="nav-group-block" key={group.title}>
              <h2 className="nav-group-heading" id={`nav-group-${group.title}`}>
                {group.title}
              </h2>
              <ul className="nav-group-list" aria-labelledby={`nav-group-${group.title}`}>
                {group.items.map((item) => {
                  const active = isActive(item);
                  const value = badgeValue(item.badge);
                  return (
                    <li key={item.to}>
                      <Link
                        to={item.to}
                        className={[
                          'sidebar-menu-link',
                          active ? 'active' : '',
                          item.danger ? 'danger' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => {
                          if (drawerOpen) setDrawerOpen(false);
                        }}
                      >
                        <span className="menu-icon-wrap" aria-hidden="true">
                          {item.icon({ size: 18 })}
                        </span>
                        <span className="menu-label-text">{item.label}</span>
                        {item.badge && value > 0 ? (
                          <>
                            <span className="sidebar-badge" aria-hidden="true">
                              {value}
                            </span>
                            <span className="sr-only">, {badgeSrText(item.badge, value)}</span>
                          </>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-footer-role">
            <span className="footer-person-icon" aria-hidden="true">
              <IconUser size={18} />
            </span>
            {roleLabel}
          </span>
          <button
            type="button"
            className="sidebar-logout-btn"
            aria-label="Keluar"
            onClick={() => {
              logout();
              navigate('/login');
            }}
          >
            <IconLogOut size={16} aria-hidden="true" />
            <span>Keluar</span>
          </button>
        </div>
      </aside>

      {/* Area konten */}
      <div className="app-main-area">
        <header className="app-topbar">
          <button
            ref={hamburgerRef}
            type="button"
            className="icon-touch-btn topbar-menu-btn"
            aria-label="Buka menu"
            aria-controls="app-sidebar"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
          >
            <IconMenu size={20} />
          </button>

          <nav className="topbar-breadcrumb" aria-label="Breadcrumb">
            <span className="crumb-root">PTSP Kemenag Sleman</span>
            <span className="crumb-divider" aria-hidden="true">
              /
            </span>
            <span className="crumb-active">{currentTitle}</span>
          </nav>

          <span className="topbar-brand-mobile">Sedakep</span>

          <form className="topbar-search-form" onSubmit={handleSearchSubmit} role="search">
            <label htmlFor="topbar-search-input" className="sr-only">
              Cari menu, permohonan, atau layanan
            </label>
            <div className="search-input-wrap">
              <IconSearch size={18} className="search-icon" aria-hidden="true" />
              <input
                id="topbar-search-input"
                type="search"
                className="topbar-search-input"
                placeholder="Cari menu, permohonan, layanan"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                autoComplete="off"
              />
            </div>
            {searchTargets.length > 0 ? (
              <ul className="search-suggest-list">
                {searchTargets.map((target) => (
                  <li key={target.label}>
                    <Link
                      to={target.to}
                      onClick={() => setSearchQuery('')}
                      className="search-suggest-link"
                    >
                      {target.label}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>

          <div className="topbar-actions">
            <div className="notif-wrap">
              <button
                type="button"
                className="icon-touch-btn"
                aria-label="Notifikasi"
                aria-expanded={notifOpen}
                onClick={() => setNotifOpen((value) => !value)}
              >
                <IconBell size={20} />
                {notifCount > 0 ? <span className="notif-dot" aria-hidden="true" /> : null}
              </button>
              {notifOpen ? (
                <div className="notif-panel" role="dialog" aria-label="Notifikasi">
                  <p className="notif-title">Notifikasi</p>
                  {notifCount === 0 ? (
                    <p className="sub">Tidak ada notifikasi baru.</p>
                  ) : (
                    <ul className="notif-list">
                      {(badges?.disposition_pending ?? 0) > 0 ? (
                        <li>
                          <Link to="/incoming-letters" onClick={() => setNotifOpen(false)}>
                            {badges?.disposition_pending} disposisi belum diproses
                          </Link>
                        </li>
                      ) : null}
                      {(badges?.leave_pending ?? 0) > 0 ? (
                        <li>
                          <Link to="/leave?tab=approvals" onClick={() => setNotifOpen(false)}>
                            {badges?.leave_pending} persetujuan cuti menunggu
                          </Link>
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <Link className="topbar-profile-chip" to="/profile" aria-label="Profil pegawai">
              <span className="user-avatar-circle" aria-hidden="true">
                <IconUser size={18} />
              </span>
              <span className="topbar-user-meta">
                <span className="topbar-user-role">{roleLabel}</span>
              </span>
            </Link>
          </div>
        </header>

        <main className="app-page-content" id="main-content">
          <Outlet />
        </main>
      </div>

      {/* Navigasi bawah (mobile) */}
      <nav className="mobile-bottom-nav" aria-label="Navigasi mobile">
        <Link
          to="/dashboard"
          className={location.pathname === '/dashboard' ? 'bottom-tab-link active' : 'bottom-tab-link'}
          aria-current={location.pathname === '/dashboard' ? 'page' : undefined}
        >
          <IconDashboard size={20} />
          <span>Beranda</span>
        </Link>
        <Link
          to="/leave"
          className={pathMatches(location.pathname, '/leave') ? 'bottom-tab-link active' : 'bottom-tab-link'}
          aria-current={pathMatches(location.pathname, '/leave') ? 'page' : undefined}
        >
          <IconFileText size={20} />
          <span>Cuti</span>
        </Link>
        <Link
          to="/services"
          className={pathMatches(location.pathname, '/services') ? 'bottom-tab-link active' : 'bottom-tab-link'}
          aria-current={pathMatches(location.pathname, '/services') ? 'page' : undefined}
        >
          <IconLayers size={20} />
          <span>Layanan</span>
        </Link>
        <Link
          to="/agenda"
          className={pathMatches(location.pathname, '/agenda') ? 'bottom-tab-link active' : 'bottom-tab-link'}
          aria-current={pathMatches(location.pathname, '/agenda') ? 'page' : undefined}
        >
          <IconCalendar size={20} />
          <span>Agenda</span>
        </Link>
        <button
          type="button"
          className="bottom-tab-link"
          aria-label="Buka menu"
          aria-controls="app-sidebar"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <IconMenu size={20} />
          <span>Menu</span>
        </button>
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
