import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import {
  durationUnitLabel,
  formatDate,
  formatMasaKerja,
  gradeLabel,
  leaveStatusLabel,
  leaveStatusTone,
} from '../format';
import * as api from '../api';
import { useAuth } from '../auth';
import {
  IconCalendarPlus,
  IconCheckSquare,
  IconFileText,
  IconHistory,
  IconSearch,
  IconUser,
} from '../components/Icons';
import { ApprovalsPanel } from './Approvals';
import { YearPicker } from '../components/YearPicker';
import { LeaveApplyModal } from '../components/LeaveApplyModal';
import { LeaveFormModal } from '../components/LeaveFormModal';
import { LeaveSkModal } from '../components/LeaveSkModal';

/**
 * Hub Manajemen & Permohonan Cuti Terpadu.
 *
 * Menggabungkan seluruh alur cuti dalam satu antarmuka terintegrasi:
 * - Pegawai: Rekap saldo kuota berjalan + histori permohonan pribadi + buku saldo & mutasi.
 * - Staf / Atasan / Admin: Arsip kantor lintas status, antrean persetujuan berjenjang,
 *   serta pemeriksaan buku kuota & mutasi pegawai.
 * - Filter status cuti dalam bentuk dropdown yang ringkas dan rapi di dalam toolbar.
 * - Status Surat Keterangan (SK) terintegrasi langsung pada setiap baris permohonan.
 */

type ArchiveFilter =
  | 'all'
  | 'belum_diperiksa'
  | 'belum_kirim'
  | 'sk_belum_upload'
  | 'cuti_jadi'
  | 'ditolak'
  | 'dibatalkan';

const ARCHIVES: Array<{ key: string; label: string; archive?: ArchiveFilter }> = [
  { key: 'semua', label: 'Semua Status' },
  { key: 'belum-diperiksa', label: 'Belum Diperiksa', archive: 'belum_diperiksa' },
  { key: 'belum-kirim', label: 'Formulir Belum Dikirim', archive: 'belum_kirim' },
  { key: 'sk-belum-unggah', label: 'SK Belum Diunggah', archive: 'sk_belum_upload' },
  { key: 'jadi', label: 'Cuti Jadi (Disetujui)', archive: 'cuti_jadi' },
  { key: 'ditolak', label: 'Ditolak', archive: 'ditolak' },
  { key: 'dibatalkan', label: 'Dibatalkan', archive: 'dibatalkan' },
];

export function LeaveList() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const isAdmin = user?.role === 'admin' || user?.username === 'admin' || user?.username === 'superadmin';
  const isStaff = isAdmin || user?.role === 'atasan' || user?.role === 'verifikator';
  const isPegawai = user?.role === 'pegawai';

  // Tab aktif
  const queryTab = params.get('tab');
  const queryUserId = params.get('user_id');
  const currentTab: string = queryTab || (queryUserId ? 'history' : 'requests');

  // Badge pending persetujuan untuk staff
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    if (isStaff) {
      api.getNavigationBadges().then((b) => setPendingCount(b.leave_pending)).catch(() => {});
    }
  }, [isStaff]);

  // Modal state for ajukan cuti, cetak formulir, cetak sk
  const [applyModalOpen, setApplyModalOpen] = useState(false);
  const [formModalId, setFormModalId] = useState<number | null>(null);
  const [skModalId, setSkModalId] = useState<number | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Deteksi jika dibuka dari luar dengan ?action=new (misal dari Dashboard)
  useEffect(() => {
    if (params.get('action') === 'new') {
      setApplyModalOpen(true);
      const next = new URLSearchParams(params);
      next.delete('action');
      setParams(next, { replace: true });
    }
  }, [params, setParams]);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const handleTabChange = (nextTab: string) => {
    const next = new URLSearchParams(params);
    if (nextTab === 'requests') {
      next.delete('tab');
      next.delete('queue');
    } else {
      next.set('tab', nextTab);
    }
    if (nextTab !== 'approvals') {
      next.delete('queue');
    }
    if (nextTab !== 'history') {
      next.delete('user_id');
    }
    next.set('page', '1');
    setParams(next);
  };

  // -------------------------------------------------------------
  // STATE & EFFECT: TAB 1 (MASTER DAFTAR PERMOHONAN)
  // -------------------------------------------------------------
  const [options, setOptions] = useState<api.LeaveTypeOption[]>([]);
  const [data, setData] = useState<api.LeaveRequestList | null>(null);
  const [stats, setStats] = useState<api.LeaveStatistics | null>(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  const page = Number(params.get('page') ?? 1);
  const search = params.get('search') ?? '';
  const archive = params.get('arsip') ?? 'semua';
  const leaveType = params.get('leave_type') ?? '';
  const year = params.get('year') ?? '';

  const activeArchive = ARCHIVES.find((item) => item.key === archive)?.archive;

  const loadRequests = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const [list, statistics] = await Promise.all([
        api.listLeaveRequests({
          page,
          search: search || undefined,
          archive: activeArchive,
          leave_type: leaveType || undefined,
          year: year ? Number(year) : undefined,
        }),
        api.getLeaveStatistics(year ? { year: Number(year) } : {}).catch(() => null),
      ]);
      setData(list);
      setStats(statistics);
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Gagal memuat permohonan');
    } finally {
      setListLoading(false);
    }
  }, [page, search, activeArchive, leaveType, year]);

  useEffect(() => {
    if (currentTab === 'requests') {
      void loadRequests();
    }
  }, [loadRequests, currentTab]);

  useEffect(() => {
    api
      .getLeaveTypeOptions()
      .then((val) => setOptions(val.types))
      .catch(() => undefined);
  }, []);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  };

  const pickArchive = (key: string) => {
    const next = new URLSearchParams(params);
    if (key === 'semua') next.delete('arsip');
    else next.set('arsip', key);
    next.set('page', '1');
    setParams(next);
  };

  const getArchiveCount = (key: string): number | null => {
    if (!stats?.by_archive) return null;
    switch (key) {
      case 'belum-diperiksa': return stats.by_archive.belum_diperiksa;
      case 'belum-kirim': return stats.by_archive.belum_kirim;
      case 'sk-belum-unggah': return stats.by_archive.sk_belum_upload;
      case 'jadi': return stats.by_archive.cuti_jadi;
      case 'ditolak': return stats.by_archive.ditolak;
      case 'dibatalkan': return stats.by_archive.dibatalkan;
      case 'semua': return stats.by_archive.total;
      default: return null;
    }
  };

  const downloadAttachment = async (documentId: number) => {
    try {
      const res = await api.getDownloadUrl(documentId);
      window.open(res.url, '_blank', 'noopener');
    } catch {
      window.alert('Gagal mengunduh lampiran');
    }
  };

  // -------------------------------------------------------------
  // STATE & EFFECT: SALDO CUTI PRIBADI (UNTUK PEGAWAI NON-ADMIN)
  // -------------------------------------------------------------
  const [personalQuota, setPersonalQuota] = useState<api.Quota | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      api.getQuota().then(setPersonalQuota).catch(() => {});
    }
  }, [isAdmin]);

  // -------------------------------------------------------------
  // STATE & EFFECT: TAB PEMERIKSAAN PEGAWAI & BUKU SALDO
  // -------------------------------------------------------------
  const [selectedUserId, setSelectedUserId] = useState<number | 'me' | null>(() => {
    if (queryUserId) {
      const parsed = Number(queryUserId);
      return Number.isNaN(parsed) ? null : parsed;
    }
    return isAdmin ? null : 'me';
  });

  useEffect(() => {
    if (queryUserId) {
      const parsed = Number(queryUserId);
      if (!Number.isNaN(parsed) && parsed !== selectedUserId) {
        setSelectedUserId(parsed);
      }
    } else {
      if (isAdmin && selectedUserId !== null) {
        setSelectedUserId(null);
      } else if (!isAdmin && selectedUserId !== 'me') {
        setSelectedUserId('me');
      }
    }
  }, [queryUserId, isAdmin]);

  const [userSearch, setUserSearch] = useState('');
  const [userOptions, setUserOptions] = useState<api.User[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  const [employeeProfile, setEmployeeProfile] = useState<{
    id: number;
    name: string;
    nip: string | null;
    grade?: string | null;
    unit_name?: string | null;
    employment_type?: string;
  } | null>(null);

  const [historySubTab, setHistorySubTab] = useState<'requests' | 'stored' | 'audits' | 'legacy'>('requests');
  const [historyFilterYear, setHistoryFilterYear] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState('');
  const [historyFilterStatus, setHistoryFilterStatus] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyRequests, setHistoryRequests] = useState<api.LeaveRequestList | null>(null);
  const [historyQuota, setHistoryQuota] = useState<api.Quota | null>(null);
  const [storedQuotas, setStoredQuotas] = useState<api.StoredQuota[]>([]);
  const [quotaAudits, setQuotaAudits] = useState<api.QuotaAudit[]>([]);
  const [legacyHistory, setLegacyHistory] = useState<api.LeaveLegacyHistoryRow[]>([]);

  const searchUsers = useCallback(async (q: string) => {
    if (!q || q.trim().length < 2) {
      setUserOptions([]);
      return;
    }
    setUserSearchLoading(true);
    try {
      const res = await api.listUsers({ search: q.trim(), per_page: 15 });
      setUserOptions(res.items);
    } catch {
      setUserOptions([]);
    } finally {
      setUserSearchLoading(false);
    }
  }, []);

  const loadHistoryData = useCallback(async () => {
    if (selectedUserId === null) {
      setHistoryLoading(false);
      setHistoryError(null);
      setHistoryRequests(null);
      setHistoryQuota(null);
      setStoredQuotas([]);
      setQuotaAudits([]);
      setLegacyHistory([]);
      setEmployeeProfile(null);
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const targetId = selectedUserId;
      const numericUserId = targetId === 'me' ? (user ? Number(user.id) : undefined) : targetId;

      const [qData, sData, aData, bookPrint, legData] = await Promise.all([
        api.getQuotaFor(targetId).catch(() => null),
        api.getStoredQuotas(targetId).catch(() => []),
        api.getQuotaHistory(targetId).catch(() => []),
        api.getQuotaBookPrint(targetId).catch(() => null),
        api.getLeaveLegacyHistory(numericUserId ? { user_id: numericUserId } : {}).catch(() => []),
      ]);

      setHistoryQuota(qData);
      setStoredQuotas(sData);
      setQuotaAudits(aData);
      setLegacyHistory(legData);

      if (bookPrint) {
        setEmployeeProfile({
          id: bookPrint.user.id,
          name: bookPrint.user.name,
          nip: bookPrint.user.nip,
          unit_name: bookPrint.user.unit_name,
        });
      } else if (targetId === 'me' && user) {
        setEmployeeProfile({
          id: Number(user.id),
          name: user.name,
          nip: user.nip,
          grade: user.grade,
          employment_type: user.employment_type,
        });
      }

      const reqRes = await api.listLeaveRequests({
        user_id: numericUserId,
        year: historyFilterYear ? Number(historyFilterYear) : undefined,
        leave_type: historyFilterType || undefined,
        status: historyFilterStatus || undefined,
        page: historyPage,
        per_page: 20,
      });

      setHistoryRequests(reqRes);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'Gagal memuat riwayat cuti');
    } finally {
      setHistoryLoading(false);
    }
  }, [selectedUserId, user, historyFilterYear, historyFilterType, historyFilterStatus, historyPage]);

  useEffect(() => {
    if (currentTab === 'history') {
      void loadHistoryData();
    }
  }, [loadHistoryData, currentTab]);

  const handleSelectUser = (u: api.User) => {
    setSelectedUserId(u.id);
    setEmployeeProfile({
      id: u.id,
      name: u.name,
      nip: u.nip,
      grade: u.grade,
      employment_type: u.employment_type,
    });
    setUserOptions([]);
    setUserSearch('');
    setHistoryPage(1);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'history');
      next.set('user_id', String(u.id));
      return next;
    });
  };

  const handleResetToMe = () => {
    setSelectedUserId('me');
    setEmployeeProfile(null);
    setHistoryPage(1);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'history');
      next.delete('user_id');
      return next;
    });
  };

  const handleApplySuccess = (_newId: number) => {
    setApplyModalOpen(false);
    setToastMessage('Permohonan cuti berhasil diajukan!');
    void loadRequests();
    if (currentTab === 'history') {
      void loadHistoryData();
    }
    if (!isAdmin) {
      api.getQuota().then(setPersonalQuota).catch(() => {});
    }
  };

  const handleClearSelectedUser = () => {
    setSelectedUserId(null);
    setEmployeeProfile(null);
    setHistoryRequests(null);
    setHistoryQuota(null);
    setStoredQuotas([]);
    setQuotaAudits([]);
    setLegacyHistory([]);
    setHistoryPage(1);
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'history');
      next.delete('user_id');
      return next;
    });
  };

  // -------------------------------------------------------------
  // JUDUL & SUBTITLE DINAMIS
  // -------------------------------------------------------------
  const pageTitle = isStaff
    ? currentTab === 'approvals'
      ? 'Persetujuan Cuti'
      : currentTab === 'history'
      ? isAdmin
        ? selectedUserId
          ? `Riwayat Cuti: ${employeeProfile?.name || 'Pegawai'}`
          : 'Pemeriksaan Riwayat Cuti Pegawai'
        : selectedUserId === 'me'
        ? 'Riwayat Cuti Saya'
        : `Riwayat Cuti: ${employeeProfile?.name || 'Pegawai'}`
      : isAdmin
      ? 'Daftar Permohonan Cuti'
      : 'Permohonan Cuti Pegawai'
    : 'Permohonan & Riwayat Cuti';

  const pageSub = isStaff
    ? currentTab === 'approvals'
      ? 'Daftar permohonan cuti yang menunggu keputusan berjenjang dan yang sudah disetujui'
      : currentTab === 'history'
      ? isAdmin && !selectedUserId
        ? 'Cari dan pilih pegawai untuk meninjau riwayat cuti lengkap, buku saldo tahunan, dan mutasi kuota'
        : 'Histori transaksi permohonan cuti, buku saldo tahunan, dan mutasi kuota pegawai'
      : 'Daftar seluruh transaksi permohonan cuti kantor, pemantauan status, dan arsip kepegawaian'
    : 'Histori seluruh transaksi permohonan cuti, status verifikasi, dan buku saldo kuota Anda';

  return (
    <Page title={pageTitle} sub={pageSub}>
      {/* =========================================================
          TOP-LEVEL TABS (UNTUK STAF: ADMIN / ATASAN / VERIFIKATOR)
          ========================================================= */}
      {isStaff ? (
        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          <button
            type="button"
            className={currentTab === 'requests' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('requests')}
          >
            <IconFileText size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
            Daftar Permohonan
          </button>
          <button
            type="button"
            className={currentTab === 'approvals' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('approvals')}
          >
            <IconCheckSquare size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
            Persetujuan Cuti
            {pendingCount > 0 ? (
              <span className="badge warn" style={{ marginLeft: '6px', fontSize: '11.5px', padding: '1px 8px' }}>
                {pendingCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className={currentTab === 'history' ? 'tab active' : 'tab'}
            onClick={() => handleTabChange('history')}
          >
            <IconHistory size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
            {isAdmin ? 'Pemeriksaan Pegawai' : 'Riwayat & Saldo Pegawai'}
          </button>
        </div>
      ) : null}

      {/* =========================================================
          HERO SALDO CUTI PRIBADI (UNTUK PEGAWAI NON-ADMIN)
          ========================================================= */}
      {!isAdmin && personalQuota && currentTab === 'requests' ? (
        <div className="panel" style={{ marginBottom: '1.25rem', borderLeft: '4px solid #0E6B4C' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#14382B' }}>
                Saldo Cuti Anda · {personalQuota.year}
              </h2>
              <div style={{ fontSize: '13px', color: '#52796F', marginTop: '3px' }}>
                Status: <span className={personalQuota.eligibility.eligible ? 'badge ok' : 'badge warn'}>
                  {personalQuota.eligibility.eligible ? 'Memenuhi Syarat' : 'Belum Eligible'}
                </span> ({formatMasaKerja(personalQuota.eligibility.months_worked)} masa kerja)
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="button small"
                onClick={() => setApplyModalOpen(true)}
              >
                <IconCalendarPlus size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                Ajukan Cuti Baru
              </button>
              <Link to="/quota/print/me" target="_blank" className="button secondary small">
                <IconFileText size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                Cetak Buku Cuti
              </Link>
            </div>
          </div>

          <div className="stats" style={{ marginTop: '14px', marginBottom: 0 }}>
            <div className="stat-card">
              <span className="stat-label">Tahun N ({personalQuota.year})</span>
              <div className="stat-value">{personalQuota.available.n} hari</div>
              <span className="stat-hint">Resmi: {personalQuota.official.n} hari</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Tahun N-1 ({personalQuota.year - 1})</span>
              <div className="stat-value">{personalQuota.available.n1} hari</div>
              <span className="stat-hint">Resmi: {personalQuota.official.n1} hari</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Tahun N-2 ({personalQuota.year - 2})</span>
              <div className="stat-value">{personalQuota.available.n2} hari</div>
              <span className="stat-hint">Resmi: {personalQuota.official.n2} hari</span>
            </div>
            <div className="stat-card ok">
              <span className="stat-label">Total Saldo Sisa</span>
              <div className="stat-value">{personalQuota.available.total} hari</div>
              <span className="stat-hint">Terpesan: {personalQuota.reserved_days} hari</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* =========================================================
          KONTEN TAB: PERSETUJUAN CUTI (STAFF)
          ========================================================= */}
      {isStaff && currentTab === 'approvals' ? (
        <ApprovalsPanel onTotalPendingChange={setPendingCount} />
      ) : null}

      {/* =========================================================
          KONTEN TAB: RIWAYAT & BUKU SALDO PEGAWAI (STAFF / DETAIL)
          ========================================================= */}
      {isStaff && currentTab === 'history' ? (
        <>
          {/* Selector Pegawai */}
          <div className="panel" style={{ marginBottom: '1.25rem', borderLeft: '4px solid #3b82f6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <strong style={{ fontSize: '14px', color: '#1e293b' }}>
                  <IconUser size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
                  {isAdmin ? 'Pemeriksaan Riwayat Cuti Pegawai (Admin)' : 'Pemeriksaan Riwayat Cuti Pegawai'}
                </strong>
                <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
                  {isAdmin
                    ? 'Cari dan pilih pegawai untuk meninjau riwayat cuti lengkap, buku saldo, dan mutasi kuota.'
                    : 'Anda dapat memilih pegawai untuk meninjau riwayat cuti lengkap lintas tahun.'}
                </p>
              </div>
              {isAdmin ? (
                selectedUserId !== null ? (
                  <button type="button" className="button secondary small" onClick={handleClearSelectedUser}>
                    Pilih Pegawai Lain
                  </button>
                ) : null
              ) : selectedUserId !== 'me' ? (
                <button type="button" className="button secondary small" onClick={handleResetToMe}>
                  Kembali ke Cuti Saya
                </button>
              ) : null}
            </div>

            <div style={{ marginTop: '12px', position: 'relative', maxWidth: '480px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="Ketik nama atau NIP pegawai..."
                  value={userSearch}
                  onChange={(e) => {
                    setUserSearch(e.target.value);
                    void searchUsers(e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="button secondary"
                  disabled={userSearchLoading}
                  onClick={() => void searchUsers(userSearch)}
                >
                  <IconSearch size={16} />
                </button>
              </div>

              {userOptions.length > 0 ? (
                <ul
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    background: '#fff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 20,
                    listStyle: 'none',
                    margin: '4px 0 0',
                    padding: '4px 0',
                    maxHeight: '240px',
                    overflowY: 'auto',
                  }}
                >
                  {userOptions.map((opt) => (
                    <li
                      key={opt.id}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f1f5f9',
                        fontSize: '13px',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                      onClick={() => handleSelectUser(opt)}
                    >
                      <strong>{opt.name}</strong> · NIP: {opt.nip || '-'} ({opt.role})
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          {historyError ? <p className="err">{historyError}</p> : null}

          {selectedUserId === null ? (
            <div
              className="panel"
              style={{
                textAlign: 'center',
                padding: '3rem 1.5rem',
                background: '#f8fafc',
                border: '1px dashed #cbd5e1',
                borderRadius: '8px',
                marginTop: '1rem',
              }}
            >
              <div style={{ maxWidth: '460px', margin: '0 auto' }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.25rem',
                  }}
                >
                  <IconSearch size={26} />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem', color: '#0f172a', fontWeight: 600 }}>
                  Pilih Pegawai untuk Melihat Riwayat Cuti
                </h3>
                <p style={{ margin: '0', fontSize: '13.5px', color: '#64748b', lineHeight: 1.6 }}>
                  Sebagai Administrator, Anda tidak memiliki riwayat cuti pribadi. Silakan gunakan kolom pencarian di atas untuk memilih pegawai dan memeriksa riwayat permohonan, buku kuota, serta mutasi cutinya.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Ringkasan Profil Pegawai & Kuota Cuti */}
              <div className="panel" style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
                      {employeeProfile?.name || user?.name}
                    </h2>
                    <div style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>
                      NIP: <strong>{employeeProfile?.nip || user?.nip || '-'}</strong>
                      {employeeProfile?.grade ? ` · Gol: ${gradeLabel(employeeProfile.grade)}` : ''}
                      {employeeProfile?.unit_name ? ` · Unit: ${employeeProfile.unit_name}` : ''}
                      {historyQuota ? (
                        <span>
                          {' '}· Status: <span className={historyQuota.eligibility.eligible ? 'badge ok' : 'badge warn'}>
                            {historyQuota.eligibility.eligible ? 'Eligible' : 'Belum Eligible'}
                          </span> ({formatMasaKerja(historyQuota.eligibility.months_worked)} masa kerja)
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Link
                      to={`/quota/print/${selectedUserId}`}
                      target="_blank"
                      className="button secondary small"
                    >
                      <IconFileText size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                      Cetak Buku Cuti (HTML)
                    </Link>
                  </div>
                </div>

                {historyQuota ? (
                  <div className="stats" style={{ marginTop: '16px', marginBottom: 0 }}>
                    <div className="stat-card">
                      <span className="stat-label">Tahun N ({historyQuota.year})</span>
                      <div className="stat-value">{historyQuota.available.n} hari</div>
                      <span className="stat-hint">Resmi: {historyQuota.official.n} hari</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Tahun N-1 ({historyQuota.year - 1})</span>
                      <div className="stat-value">{historyQuota.available.n1} hari</div>
                      <span className="stat-hint">Resmi: {historyQuota.official.n1} hari</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-label">Tahun N-2 ({historyQuota.year - 2})</span>
                      <div className="stat-value">{historyQuota.available.n2} hari</div>
                      <span className="stat-hint">Resmi: {historyQuota.official.n2} hari</span>
                    </div>
                    <div className="stat-card ok">
                      <span className="stat-label">Total Kuota Sisa</span>
                      <div className="stat-value">{historyQuota.available.total} hari</div>
                      <span className="stat-hint">Reserved: {historyQuota.reserved_days} hari</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Sub-tabs Tampilan Riwayat Pegawai */}
              <div className="tabs">
                <button
                  type="button"
                  className={historySubTab === 'requests' ? 'tab active' : 'tab'}
                  onClick={() => setHistorySubTab('requests')}
                >
                  <IconHistory size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '6px' }} />
                  Riwayat Pengajuan ({historyRequests?.total ?? 0})
                </button>
                <button
                  type="button"
                  className={historySubTab === 'stored' ? 'tab active' : 'tab'}
                  onClick={() => setHistorySubTab('stored')}
                >
                  Buku Saldo Tahunan ({storedQuotas.length})
                </button>
                <button
                  type="button"
                  className={historySubTab === 'audits' ? 'tab active' : 'tab'}
                  onClick={() => setHistorySubTab('audits')}
                >
                  Audit & Mutasi Kuota ({quotaAudits.length})
                </button>
                {legacyHistory.length > 0 ? (
                  <button
                    type="button"
                    className={historySubTab === 'legacy' ? 'tab active' : 'tab'}
                    onClick={() => setHistorySubTab('legacy')}
                  >
                    Arsip Pra-2020 ({legacyHistory.length})
                  </button>
                ) : null}
              </div>

              {/* SUBTAB 1: DAFTAR PERMOHONAN PEGAWAI */}
              {historySubTab === 'requests' ? (
                <div className="panel" style={{ marginTop: '1rem' }}>
                  <div className="toolbar" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                    <select
                      value={historyFilterStatus}
                      onChange={(e) => {
                        setHistoryFilterStatus(e.target.value);
                        setHistoryPage(1);
                      }}
                      aria-label="Filter status permohonan pegawai"
                    >
                      <option value="">Semua Status</option>
                      <option value="approved">Disetujui</option>
                      <option value="in_review">Dalam Proses</option>
                      <option value="rejected">Ditolak</option>
                      <option value="cancelled">Dibatalkan</option>
                    </select>

                    <select
                      value={historyFilterType}
                      onChange={(e) => {
                        setHistoryFilterType(e.target.value);
                        setHistoryPage(1);
                      }}
                      aria-label="Filter jenis cuti"
                    >
                      <option value="">Semua Jenis Cuti</option>
                      {options.map((opt) => (
                        <option key={opt.name} value={opt.name}>{opt.name}</option>
                      ))}
                    </select>

                    <YearPicker
                      value={historyFilterYear}
                      onChange={(y) => {
                        setHistoryFilterYear(y);
                        setHistoryPage(1);
                      }}
                    />

                    {historyFilterStatus || historyFilterType || historyFilterYear ? (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => {
                          setHistoryFilterStatus('');
                          setHistoryFilterType('');
                          setHistoryFilterYear('');
                          setHistoryPage(1);
                        }}
                        style={{ height: '38px', padding: '0 12px' }}
                      >
                        Reset Filter
                      </button>
                    ) : null}
                  </div>

                  {historyLoading ? (
                    <p className="sub">Memuat riwayat transaksi cuti...</p>
                  ) : !historyRequests || historyRequests.items.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon" aria-hidden="true">
                        <IconHistory size={28} />
                      </div>
                      <p>Belum ada riwayat permohonan cuti untuk kriteria ini.</p>
                    </div>
                  ) : (
                    <>
                      <div className="table-wrap" style={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <table className="table-leave">
                          <thead>
                            <tr>
                              <th style={{ width: '40px', textAlign: 'center' }}>No</th>
                              <th style={{ width: '13%' }}>Tgl Pengajuan</th>
                              <th style={{ width: '22%' }}>Jenis Cuti & Alasan</th>
                              <th style={{ width: '20%' }}>Pelaksanaan & Durasi</th>
                              <th style={{ width: '13%' }}>Status</th>
                              <th style={{ width: '18%' }}>Surat Keterangan (SK)</th>
                              <th style={{ width: '14%', textAlign: 'right' }}>Aksi</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historyRequests.items.map((item, idx) => (
                              <tr key={item.id}>
                                <td style={{ textAlign: 'center' }}>
                                  <span className="mono" style={{ color: '#64748b', fontSize: '12px' }}>
                                    {(historyPage - 1) * historyRequests.per_page + idx + 1}
                                  </span>
                                </td>
                                <td>
                                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                                    {formatDate(item.created_at || item.submitted_at || item.start_date)}
                                  </div>
                                  {item.attachment_document_id ? (
                                    <button
                                      type="button"
                                      className="attachment-pill"
                                      onClick={() => downloadAttachment(item.attachment_document_id as number)}
                                      title={item.attachment_filename || 'Unduh lampiran'}
                                    >
                                      📎 Lampiran
                                    </button>
                                  ) : null}
                                </td>
                                <td>
                                  <strong style={{ color: '#1e293b', fontSize: '13px' }}>{item.leave_type}</strong>
                                  {item.reason ? (
                                    <div
                                      style={{ fontSize: '11.5px', color: '#64748b', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}
                                      title={item.reason}
                                    >
                                      {item.reason}
                                    </div>
                                  ) : null}
                                </td>
                                <td>
                                  <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b' }}>
                                    {formatDate(item.start_date)}
                                    {item.start_date !== item.end_date ? ` – ${formatDate(item.end_date)}` : ''}
                                  </div>
                                  <div style={{ marginTop: '3px' }}>
                                    <span className="badge muted" style={{ fontSize: '10.5px', padding: '1px 7px' }}>
                                      {item.duration} {durationUnitLabel(item.duration_unit)}
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className={leaveStatusTone(item.status)} style={{ fontSize: '11px' }}>
                                    {leaveStatusLabel(item.status)}
                                  </span>
                                </td>
                                <td>
                                  {item.status === 'rejected' || item.status === 'cancelled' ? (
                                    <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                                  ) : item.letter_number ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <strong className="mono" style={{ fontSize: '11.5px', color: '#166534' }}>
                                        {item.letter_number}
                                      </strong>
                                      {item.letter_document_id ? (
                                        <span className="badge ok" style={{ fontSize: '9.5px', padding: '1px 5px', width: 'fit-content' }}>
                                          Berkas SK siap
                                        </span>
                                      ) : (
                                        <span className="badge warn" style={{ fontSize: '9.5px', padding: '1px 5px', width: 'fit-content' }}>
                                          Berkas belum diunggah
                                        </span>
                                      )}
                                    </div>
                                  ) : item.status === 'approved' || item.admin_decision === 'accepted' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                      <span className="badge danger" style={{ fontSize: '10px', padding: '2px 6px', width: 'fit-content' }}>
                                        Belum diberi SK
                                      </span>
                                      {isStaff ? (
                                        <Link
                                          to={`/leave/${item.id}`}
                                          style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, textDecoration: 'underline' }}
                                        >
                                          + Terbitkan SK
                                        </Link>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <span className="badge muted" style={{ fontSize: '10px' }}>
                                      Menunggu persetujuan
                                    </span>
                                  )}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                  <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                    <Link
                                      to={`/leave/${item.id}`}
                                      className={item.admin_decision === 'pending' && isStaff ? 'button small' : 'button small secondary'}
                                      style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }}
                                    >
                                      {item.admin_decision === 'pending' && isStaff ? 'Periksa' : 'Detail'}
                                    </Link>
                                    {!item.letter_number && (item.status === 'approved' || item.admin_decision === 'accepted') && isStaff ? (
                                      <Link
                                        className="button small primary"
                                        to={`/leave/${item.id}`}
                                        style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }}
                                      >
                                        + SK
                                      </Link>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => setFormModalId(item.id)}
                                      className="button small secondary"
                                      style={{ height: '28px', padding: '0 7px', fontSize: '11.5px' }}
                                      title="Pratinjau & Cetak Formulir Cuti"
                                    >
                                      Form
                                    </button>
                                    {item.letter_number ? (
                                      <button
                                        type="button"
                                        onClick={() => setSkModalId(item.id)}
                                        className="button small secondary"
                                        style={{ height: '28px', padding: '0 7px', fontSize: '11.5px' }}
                                        title="Pratinjau & Cetak Surat Keterangan Cuti"
                                      >
                                        SK
                                      </button>
                                    ) : null}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {historyRequests.total_pages > 1 ? (
                        <div className="pager" style={{ marginTop: '12px' }}>
                          <button
                            type="button"
                            className="button secondary small"
                            disabled={historyPage <= 1}
                            onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                          >
                            ← Sebelumnya
                          </button>
                          <span className="pager-info">
                            Halaman {historyPage} dari {historyRequests.total_pages} ({historyRequests.total} total)
                          </span>
                          <button
                            type="button"
                            className="button secondary small"
                            disabled={historyPage >= historyRequests.total_pages}
                            onClick={() => setHistoryPage((p) => Math.min(historyRequests.total_pages, p + 1))}
                          >
                            Berikutnya →
                          </button>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              ) : null}

              {/* SUBTAB 2: BUKU SALDO TAHUNAN */}
              {historySubTab === 'stored' ? (
                <div className="panel" style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px' }}>Buku Saldo Cuti per Tahun</h3>
                    <Link
                      to={`/quota/print/${selectedUserId}`}
                      target="_blank"
                      className="button secondary small"
                    >
                      Cetak Buku Cuti Lengkap
                    </Link>
                  </div>

                  {storedQuotas.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon" aria-hidden="true">
                        <IconHistory size={28} />
                      </div>
                      <p>Belum ada data proyeksi saldo tersimpan untuk pegawai ini.</p>
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Tahun</th>
                            <th>Sisa N</th>
                            <th>Sisa N-1</th>
                            <th>Sisa N-2</th>
                            <th>Total Sisa</th>
                            <th>Terpesan (Reserved)</th>
                            <th>Eligibilitas</th>
                            <th>Waktu Dihitung</th>
                          </tr>
                        </thead>
                        <tbody>
                          {storedQuotas.map((sq) => (
                            <tr key={sq.year}>
                              <td><strong>{sq.year}</strong></td>
                              <td><strong>{sq.remaining_n}</strong> hari</td>
                              <td><strong>{sq.remaining_n1}</strong> hari</td>
                              <td><strong>{sq.remaining_n2}</strong> hari</td>
                              <td>
                                <strong style={{ color: sq.total_remaining > 0 ? '#15803d' : '#b91c1c' }}>
                                  {sq.total_remaining} hari
                                </strong>
                              </td>
                              <td>{sq.reserved_days} hari ({sq.reserved_count} pengajuan)</td>
                              <td>
                                <span className={sq.eligible === 1 ? 'badge ok' : 'badge warn'} style={{ fontSize: '10.5px' }}>
                                  {sq.eligible === 1 ? 'Eligible' : 'Belum Eligible'}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px', color: '#64748b' }}>
                                {sq.computed_at ? formatDate(sq.computed_at) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {/* SUBTAB 3: AUDIT & MUTASI KUOTA */}
              {historySubTab === 'audits' ? (
                <div className="panel" style={{ marginTop: '1rem' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>Log Mutasi & Audit Kuota</h3>
                  {quotaAudits.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon" aria-hidden="true">
                        <IconHistory size={28} />
                      </div>
                      <p>Belum ada catatan mutasi kuota untuk pegawai ini.</p>
                    </div>
                  ) : (
                    <div className="table-wrap" style={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                      <table>
                        <thead>
                          <tr>
                            <th>Waktu</th>
                            <th>Tahun</th>
                            <th>Aksi</th>
                            <th>Selisih (Hari)</th>
                            <th>Alasan / Keterangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {quotaAudits.map((a) => (
                            <tr key={a.id}>
                              <td style={{ fontSize: '12px' }}>{formatDate(a.created_at)}</td>
                              <td><strong>{a.year ?? '-'}</strong></td>
                              <td><span className="badge" style={{ fontSize: '11px' }}>{a.action}</span></td>
                              <td style={{ fontWeight: 600 }}>
                                <span className={a.difference !== null && a.difference > 0 ? 'badge ok' : a.difference !== null && a.difference < 0 ? 'badge bad' : 'badge muted'} style={{ fontSize: '11px' }}>
                                  {a.difference !== null ? (a.difference > 0 ? `+${a.difference}` : a.difference) : '-'}
                                </span>
                              </td>
                              <td style={{ fontSize: '12px', color: '#475569' }}>
                                {a.reason || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : null}

              {/* SUBTAB 4: ARSIP PRA-2020 */}
              {historySubTab === 'legacy' ? (
                <div className="panel" style={{ marginTop: '1rem' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: '14px' }}>Arsip Cuti Pra-2020 (Migrasi Legacy N-2019)</h3>
                  <p className="sub" style={{ marginBottom: '14px' }}>
                    Data historis cuti sebelum tahun 2020 yang diimpor dari sistem lama sebagai arsip kepegawaian.
                  </p>
                  <div className="table-wrap" style={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Tahun</th>
                          <th>Jenis Cuti</th>
                          <th>Durasi</th>
                          <th>Tanggal Pelaksanaan</th>
                          <th>Nomor SK / Surat</th>
                          <th>Tanggal Terbit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {legacyHistory.map((row, idx) => (
                          <tr key={idx}>
                            <td><span className="mono">{row.year}</span></td>
                            <td><strong>{row.leave_type}</strong></td>
                            <td>{row.duration} {durationUnitLabel(row.duration_unit)}</td>
                            <td>
                              {row.start_date ? formatDate(row.start_date) : '-'}
                              {row.end_date && row.end_date !== row.start_date ? ` s.d. ${formatDate(row.end_date)}` : ''}
                            </td>
                            <td><span className="mono">{row.number || '-'}</span></td>
                            <td>{row.issued_at ? formatDate(row.issued_at) : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {/* =========================================================
          KONTEN TAB 1: MASTER DAFTAR PERMOHONAN CUTI (DEFAULT)
          ========================================================= */}
      {currentTab === 'requests' ? (
        <>
          {/* Toolbar Pencarian & Filter dengan Dropdown Status */}
          <div className="toolbar" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {!isPegawai ? (
              <input
                placeholder="Cari nama, NIP, atau ID..."
                defaultValue={search}
                style={{ minWidth: '220px' }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') updateParam('search', (event.target as HTMLInputElement).value);
                }}
              />
            ) : null}

            {/* Dropdown Status Permohonan (Menggantikan Bar Tab Panjang) */}
            <select
              value={archive}
              onChange={(e) => pickArchive(e.target.value)}
              aria-label="Filter status pengajuan cuti"
            >
              {ARCHIVES.map((item) => {
                const count = getArchiveCount(item.key);
                return (
                  <option key={item.key} value={item.key}>
                    {item.label}{count !== null ? ` (${count})` : ''}
                  </option>
                );
              })}
            </select>

            <select
              value={leaveType}
              onChange={(event) => updateParam('leave_type', event.target.value)}
              aria-label="Filter jenis cuti"
            >
              <option value="">Semua jenis cuti</option>
              {options.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.name}
                </option>
              ))}
            </select>

            {/* Flexible Year Picker ("Kotak Tahun") */}
            <YearPicker
              value={year}
              onChange={(newYear) => updateParam('year', newYear)}
            />

            {((!isPegawai && search) || archive !== 'semua' || leaveType || year) ? (
              <button
                type="button"
                className="button secondary small"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete('search');
                  next.delete('arsip');
                  next.delete('leave_type');
                  next.delete('year');
                  next.set('page', '1');
                  setParams(next);
                }}
                style={{ height: '38px', padding: '0 12px' }}
              >
                Reset Filter
              </button>
            ) : null}

            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {isAdmin ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={async () => {
                    try {
                      await api.downloadLeaveExport({
                        search: search || undefined,
                        leave_type: leaveType || undefined,
                      });
                    } catch {
                      window.alert('Gagal mengunduh berkas ekspor permohonan');
                    }
                  }}
                >
                  Ekspor CSV
                </button>
              ) : null}

              <button type="button" className="button" onClick={() => setApplyModalOpen(true)}>
                <IconCalendarPlus size={16} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
                Ajukan Cuti
              </button>
            </div>
          </div>

          {listError ? <p className="err">{listError}</p> : null}
          {listLoading ? <p className="sub">Memuat daftar permohonan...</p> : null}

          {data ? (
            <>
              {data.items.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon" aria-hidden="true">
                    <IconFileText size={28} />
                  </div>
                  <p>Tidak ada data permohonan cuti yang sesuai dengan filter ini.</p>
                  <button type="button" className="button" onClick={() => setApplyModalOpen(true)}>
                    <IconCalendarPlus size={18} />
                    <span>Ajukan Cuti Baru</span>
                  </button>
                </div>
              ) : (
                <div className="table-wrap" style={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <table className="table-leave">
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>No.</th>
                        {!isPegawai ? <th style={{ width: '18%' }}>Pegawai</th> : null}
                        <th style={{ width: isPegawai ? '15%' : '12%' }}>Tgl Pengajuan</th>
                        <th style={{ width: isPegawai ? '23%' : '17%' }}>Jenis Cuti & Alasan</th>
                        <th style={{ width: isPegawai ? '20%' : '15%' }}>Pelaksanaan & Durasi</th>
                        <th style={{ width: isPegawai ? '13%' : '11%' }}>Status</th>
                        <th style={{ width: isPegawai ? '17%' : '15%' }}>Surat Keterangan (SK)</th>
                        <th style={{ width: '12%', textAlign: 'right' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.items.map((item, idx) => (
                        <tr key={item.id}>
                          <td style={{ textAlign: 'center' }}>
                            <span className="mono" style={{ color: '#64748b', fontSize: '12px' }}>
                              {(page - 1) * data.per_page + idx + 1}
                            </span>
                          </td>
                          {!isPegawai ? (
                            <td>
                              <Link
                                to={`/leave/${item.id}`}
                                style={{ color: '#0f172a', fontWeight: 600, fontSize: '13px', textDecoration: 'none' }}
                              >
                                {item.name}
                              </Link>
                              <div className="mono" style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                NIP. {item.nip ?? '-'}
                              </div>
                            </td>
                          ) : null}
                          <td>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: '#1e293b' }}>
                              {formatDate(item.created_at || item.submitted_at || item.start_date)}
                            </div>
                            {item.attachment_document_id ? (
                              <button
                                type="button"
                                className="attachment-pill"
                                onClick={() => downloadAttachment(item.attachment_document_id as number)}
                                title={item.attachment_filename || 'Unduh Berkas Lampiran'}
                              >
                                📎 Lampiran
                              </button>
                            ) : null}
                          </td>
                          <td>
                            <strong style={{ color: '#1e293b', fontSize: '13px' }}>{item.leave_type}</strong>
                            {item.reason ? (
                              <div
                                style={{
                                  fontSize: '11.5px',
                                  color: '#64748b',
                                  maxWidth: '180px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  marginTop: '2px',
                                }}
                                title={item.reason}
                              >
                                {item.reason}
                              </div>
                            ) : null}
                          </td>
                          <td>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b' }}>
                              {formatDate(item.start_date)}
                              {item.start_date !== item.end_date ? ` – ${formatDate(item.end_date)}` : ''}
                            </div>
                            <div style={{ marginTop: '3px' }}>
                              <span className="badge muted" style={{ fontSize: '10.5px', padding: '1px 7px' }}>
                                {item.duration} {durationUnitLabel(item.duration_unit)}
                              </span>
                            </div>
                          </td>
                          <td>
                            <span className={leaveStatusTone(item.status)} style={{ fontSize: '11px' }}>
                              {leaveStatusLabel(item.status)}
                            </span>
                            {item.admin_decision === 'pending' ? (
                              <div style={{ marginTop: '3px' }}>
                                <span className="badge warn" style={{ fontSize: '9.5px', padding: '1px 5px' }}>Belum diperiksa</span>
                              </div>
                            ) : null}
                          </td>
                          <td>
                            {item.status === 'rejected' || item.status === 'cancelled' ? (
                              <span style={{ color: '#94a3b8', fontSize: '12px' }}>-</span>
                            ) : item.letter_number ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <strong className="mono" style={{ fontSize: '11.5px', color: '#166534' }}>
                                  {item.letter_number}
                                </strong>
                                {item.letter_document_id ? (
                                  <span className="badge ok" style={{ fontSize: '9.5px', padding: '1px 5px', width: 'fit-content' }}>
                                    Berkas SK siap
                                  </span>
                                ) : (
                                  <span className="badge warn" style={{ fontSize: '9.5px', padding: '1px 5px', width: 'fit-content' }}>
                                    Berkas belum diunggah
                                  </span>
                                )}
                              </div>
                            ) : item.status === 'approved' || item.admin_decision === 'accepted' ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                <span className="badge danger" style={{ fontSize: '10px', padding: '2px 6px', width: 'fit-content' }}>
                                  Belum diberi SK
                                </span>
                                {isStaff ? (
                                  <Link
                                    to={`/leave/${item.id}`}
                                    style={{ fontSize: '11px', color: '#0284c7', fontWeight: 600, textDecoration: 'underline' }}
                                  >
                                    + Terbitkan SK
                                  </Link>
                                ) : null}
                              </div>
                            ) : (
                              <span className="badge muted" style={{ fontSize: '10px' }}>
                                Menunggu persetujuan
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              <Link
                                className={item.admin_decision === 'pending' && isStaff ? 'button small' : 'button small secondary'}
                                to={`/leave/${item.id}`}
                                style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }}
                              >
                                {item.admin_decision === 'pending' && isStaff ? 'Periksa' : 'Detail'}
                              </Link>
                              {!item.letter_number && (item.status === 'approved' || item.admin_decision === 'accepted') && isStaff ? (
                                <Link
                                  className="button small primary"
                                  to={`/leave/${item.id}`}
                                  style={{ height: '28px', padding: '0 8px', fontSize: '11.5px' }}
                                >
                                  + SK
                                </Link>
                              ) : null}
                              {item.admin_decision === 'accepted' ? (
                                <button
                                  type="button"
                                  className="button small secondary"
                                  onClick={() => setFormModalId(item.id)}
                                  style={{ height: '28px', padding: '0 7px', fontSize: '11.5px' }}
                                  title="Pratinjau & Cetak Formulir Cuti"
                                >
                                  Form
                                </button>
                              ) : null}
                              {item.letter_number ? (
                                <button
                                  type="button"
                                  className="button small secondary"
                                  onClick={() => setSkModalId(item.id)}
                                  style={{ height: '28px', padding: '0 7px', fontSize: '11.5px' }}
                                  title="Pratinjau & Cetak Surat Keterangan Cuti"
                                >
                                  SK
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pager */}
              <div className="pager">
                <button
                  className="button secondary small"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => updateParam('page', String(page - 1))}
                >
                  ← Sebelumnya
                </button>
                <span className="pager-info">
                  Halaman <strong>{data.page}</strong> dari {data.total_pages || 1} ({data.total} data)
                </span>
                <button
                  className="button secondary small"
                  type="button"
                  disabled={page >= data.total_pages}
                  onClick={() => updateParam('page', String(page + 1))}
                >
                  Berikutnya →
                </button>
              </div>

              {/* Rekap per Jenis Cuti */}
              {stats && stats.by_type.length > 0 ? (
                <div className="panel" style={{ marginTop: '1.5rem' }}>
                  <h3 style={{ margin: '0 0 12px', fontSize: '14px' }}>Rekap per Jenis Cuti</h3>
                  <div className="table-wrap" style={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Jenis Cuti</th>
                          <th className="numeric">Jumlah Permohonan</th>
                          <th className="numeric">Total Hari</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.by_type.map((row) => (
                          <tr key={row.key}>
                            <td><strong>{row.key}</strong></td>
                            <td className="numeric">{row.total}</td>
                            <td className="numeric">{row.days} hari</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}

      <LeaveApplyModal
        isOpen={applyModalOpen}
        onClose={() => setApplyModalOpen(false)}
        onSuccess={handleApplySuccess}
      />

      <LeaveFormModal
        requestId={formModalId}
        isOpen={formModalId !== null}
        onClose={() => setFormModalId(null)}
      />

      <LeaveSkModal
        requestId={skModalId}
        isOpen={skModalId !== null}
        onClose={() => setSkModalId(null)}
      />

      {toastMessage ? (
        <div className="app-toast-container">
          <div className="app-toast success">
            <span>✓</span>
            <span>{toastMessage}</span>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
