import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import { useAuth } from '../auth';
import * as api from '../api';
import {
  IconCalendarPlus,
  IconBriefcase,
  IconClock,
  IconLayers,
  IconArrowUpRight,
  IconArrowRight,
  IconHelpCircle,
} from '../components/Icons';

/** Menghitung salam dinamis zona waktu Asia/Jakarta (WIB = UTC+7) */
function getIndonesianGreeting(): string {
  const now = new Date();
  const utcHours = now.getUTCHours();
  const wibHours = (utcHours + 7) % 24;
  if (wibHours >= 4 && wibHours < 11) return 'Selamat pagi';
  if (wibHours >= 11 && wibHours < 15) return 'Selamat siang';
  if (wibHours >= 15 && wibHours < 18) return 'Selamat sore';
  return 'Selamat malam';
}

/** Menghitung tanggal Indonesia dinamis zona waktu Asia/Jakarta */
function getIndonesianFormattedDate(): string {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  });
  return formatter.format(now).toUpperCase();
}

const isStaffRole = (role: string | undefined) =>
  role === 'admin' || role === 'verifikator' || role === 'atasan';

export function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.username === 'admin' || user?.username === 'superadmin';
  const isStaff = isStaffRole(user?.role);

  const [quota, setQuota] = useState<api.Quota | null>(null);
  const [requests, setRequests] = useState<api.LeaveRequest[]>([]);
  const [summary, setSummary] = useState<{
    cuti: number;
    surtug: number;
    alibi: number;
    suratMasuk: number;
    layanan: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const nowYear = new Date().getFullYear();
  const [crosstabYear, setCrosstabYear] = useState(nowYear);
  const [yearlySummaries, setYearlySummaries] = useState<api.LeaveYearlySummary[]>([]);
  const [crosstabRows, setCrosstabRows] = useState<api.LeaveCrosstabRow[]>([]);
  const [crosstabSearch, setCrosstabSearch] = useState('');
  const [loadingCrosstab, setLoadingCrosstab] = useState(false);

  const greeting = getIndonesianGreeting();
  const todayFormatted = getIndonesianFormattedDate();
  const firstName = user?.name ? user.name.trim().split(/\s+/)[0] : 'Pegawai';

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [quotaData, list] = await Promise.all([
          isAdmin ? Promise.resolve(null) : api.getQuota().catch(() => null),
          api.listLeaveRequests({ page: 1 }),
        ]);
        if (!alive) return;
        setQuota(quotaData);
        setRequests(list.items.slice(0, 5));
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat data');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isStaff) return;
    let alive = true;
    (async () => {
      const [cuti, surtug, alibi, suratMasuk, layanan] = await Promise.all([
        api.listLeaveRequests({ status: 'in_review', page: 1 }).catch(() => null),
        api.listAssignmentLetters({ status: 'submitted', page: 1 }).catch(() => null),
        api.listAlibiRequests({ status: 'in_review', page: 1 }).catch(() => null),
        api.listIncomingLetters({ status: 'baru', page: 1 }).catch(() => null),
        api.listServiceRequests({ status: 'submitted', page: 1 }).catch(() => null),
      ]);
      if (!alive) return;
      setSummary({
        cuti: cuti?.total ?? 0,
        surtug: surtug?.total ?? 0,
        alibi: alibi?.total ?? 0,
        suratMasuk: suratMasuk?.total ?? 0,
        layanan: layanan?.total ?? 0,
      });
    })();
    return () => {
      alive = false;
    };
  }, [isStaff]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void (async () => {
      try {
        const summaries = await api.getLeaveYearlySummary();
        if (!alive) return;
        setYearlySummaries(summaries);
        if (summaries.length > 0 && !summaries.some((s) => s.year === crosstabYear)) {
          setCrosstabYear(summaries[0].year);
        }
      } catch {
        // Abaikan error background
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    setLoadingCrosstab(true);
    void (async () => {
      try {
        const rows = await api.getLeaveCrosstab(crosstabYear);
        if (!alive) return;
        setCrosstabRows(rows);
      } catch {
        if (alive) setCrosstabRows([]);
      } finally {
        if (alive) setLoadingCrosstab(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, crosstabYear]);

  // Perhitungan rasio progress bar kuota tahun ini
  const officialN = quota?.official.n ?? 12;
  const availableN = quota?.available.n ?? 0;
  const progressPercent = Math.min(
    100,
    Math.max(0, officialN > 0 ? Math.round((availableN / officialN) * 100) : 0)
  );

  const selectedYearSummary = yearlySummaries.find((s) => s.year === crosstabYear);
  const filteredCrosstab = crosstabRows.filter(
    (r) =>
      !crosstabSearch ||
      r.name.toLowerCase().includes(crosstabSearch.toLowerCase()) ||
      (r.nip && r.nip.includes(crosstabSearch)),
  );

  return (
    <div className="dashboard-view">
      {/* 1. Sapaan & Tanggal Dinamis */}
      <section className="dashboard-greeting-block" aria-labelledby="greeting-heading">
        <div className="greeting-date-label">{todayFormatted}</div>
        <h1 id="greeting-heading" className="greeting-title">
          {greeting}, {firstName}
        </h1>
        <p className="greeting-subtitle">
          {isAdmin
            ? 'Ringkasan antrean kepegawaian dan administrasi layanan.'
            : 'Ringkasan saldo cuti dan status antrean kepegawaian Anda.'}
        </p>
      </section>

      {/* Loading & Error States */}
      {loading ? (
        <div className="dashboard-state-card loading">
          <div className="spinner-indicator" aria-hidden="true" />
          <p>Memuat data kepegawaian Anda...</p>
        </div>
      ) : null}

      {error ? (
        <div className="dashboard-state-card error">
          <p className="state-err-msg">{error}</p>
        </div>
      ) : null}

      {/* Antrean Tugas Staf (Khusus Verifikator, Atasan, Admin) */}
      {isStaff && summary ? (
        <section className="dashboard-block staff-queue-block" aria-labelledby="staff-heading">
          <h2 id="staff-heading" className="block-heading">
            Antrean Tugas Staf
          </h2>
          <div className="staff-queue-grid">
            <Link className="queue-card" to="/leave?tab=approvals">
              <span className="queue-label">Cuti Menunggu</span>
              <span className="queue-value">{summary.cuti}</span>
              <span className="queue-hint">permohonan belum final</span>
            </Link>
            <Link className="queue-card" to="/assignments?status=submitted">
              <span className="queue-label">Surat Tugas Baru</span>
              <span className="queue-value">{summary.surtug}</span>
              <span className="queue-hint">belum diputus</span>
            </Link>
            <Link className="queue-card" to="/alibi?status=in_review">
              <span className="queue-label">Alibi Menunggu</span>
              <span className="queue-value">{summary.alibi}</span>
              <span className="queue-hint">belum final</span>
            </Link>
            <Link className="queue-card" to="/incoming-letters?status=baru">
              <span className="queue-label">Surat Masuk Baru</span>
              <span className="queue-value">{summary.suratMasuk}</span>
              <span className="queue-hint">belum didisposisi</span>
            </Link>
            <Link className="queue-card" to="/services?status=submitted">
              <span className="queue-label">Layanan Menunggu</span>
              <span className="queue-value">{summary.layanan}</span>
              <span className="queue-hint">pensiun, gelar, dll</span>
            </Link>
          </div>
        </section>
      ) : null}

      {/* 2. Saldo Cuti Pegawai (Hero Hijau + 3 Kartu Putih Bertumpuk) - Khusus Pegawai & Staf Non-Admin */}
      {!isAdmin ? (
        <section className="dashboard-block quota-section" aria-labelledby="quota-heading">
          <h2 id="quota-heading" className="block-heading">
            Saldo Cuti Pegawai
          </h2>

          <div className="quota-row-layout">
            {/* Kartu Hero Hijau */}
            <div className="quota-hero-card">
              <div className="quota-hero-label">
                SALDO TAHUN INI (N) · {nowYear}
              </div>
              <div className="quota-hero-value-wrap">
                <span className="quota-hero-number">{quota ? quota.available.n : '-'}</span>
                <span className="quota-hero-unit">hari</span>
              </div>

              <div
                className="quota-progress-track"
                role="progressbar"
                aria-valuenow={availableN}
                aria-valuemin={0}
                aria-valuemax={officialN}
                aria-label="Progres saldo cuti tahun ini terhadap kuota"
              >
                <div
                  className="quota-progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="quota-hero-meta">
                dari kuota resmi {quota ? quota.official.n : 12} hari
              </div>
            </div>

            {/* Tiga Kartu Putih Bertumpuk */}
            <div className="quota-stacked-cards">
              {/* Sisa N-1 */}
              <div className="quota-stack-card">
                <div className="stack-card-num">
                  {quota ? quota.available.n1 : 0}
                </div>
                <div className="stack-card-text">
                  <div className="stack-card-label">
                    SISA TAHUN LALU (N-1) · {nowYear - 1}
                  </div>
                  <div className="stack-card-desc">
                    maksimum {quota?.official.n1 ?? 6} hari
                  </div>
                </div>
              </div>

              {/* Sisa N-2 */}
              <div className="quota-stack-card">
                <div className="stack-card-num">
                  {quota ? quota.available.n2 : 0}
                </div>
                <div className="stack-card-text">
                  <div className="stack-card-label">
                    SISA DUA TAHUN LALU (N-2) · {nowYear - 2}
                  </div>
                  <div className="stack-card-desc">
                    maksimum {quota?.official.n2 ?? 6} hari
                  </div>
                </div>
              </div>

              {/* Cuti Terpesan */}
              <div className="quota-stack-card">
                <div className="stack-card-num warning">
                  {quota ? quota.reserved_days : 0}
                </div>
                <div className="stack-card-text">
                  <div className="stack-card-label">CUTI TERPESAN</div>
                  <div className="stack-card-desc">
                    {quota ? quota.reserved_count : 0} permohonan menunggu
                  </div>
                </div>
              </div>
            </div>
          </div>

          {quota && !quota.eligibility.eligible ? (
            <div className="quota-eligibility-notice">
              <strong>Perhatian:</strong> Belum memenuhi syarat cuti tahunan: {quota.eligibility.reason}
              {quota.eligibility.manual_validation ? ' (memerlukan validasi manual oleh admin)' : ''}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* 3. Aksi Cepat: Grid 4 Kartu */}
      <section className="dashboard-block quick-actions-section" aria-labelledby="actions-heading">
        <h2 id="actions-heading" className="sr-only">
          Aksi Cepat
        </h2>
        <div className="quick-actions-grid">
          {/* Ajukan Cuti (Primer Hijau) */}
          <Link className="action-card primary" to="/leave?action=new">
            <div className="action-card-icon-box" aria-hidden="true">
              <IconCalendarPlus size={22} />
            </div>
            <span className="action-card-title">Ajukan Cuti</span>
            <span className="action-card-arrow" aria-hidden="true">
              <IconArrowUpRight size={18} />
            </span>
          </Link>

          {/* Buat Surat Tugas */}
          <Link className="action-card outline" to="/assignments/new">
            <div className="action-card-icon-box" aria-hidden="true">
              <IconBriefcase size={22} />
            </div>
            <span className="action-card-title">Buat Surat Tugas</span>
            <span className="action-card-arrow" aria-hidden="true">
              <IconArrowUpRight size={18} />
            </span>
          </Link>

          {/* Ajukan Alibi */}
          <Link className="action-card outline" to="/alibi/new">
            <div className="action-card-icon-box" aria-hidden="true">
              <IconClock size={22} />
            </div>
            <span className="action-card-title">Ajukan Alibi</span>
            <span className="action-card-arrow" aria-hidden="true">
              <IconArrowUpRight size={18} />
            </span>
          </Link>

          {/* Permohonan Layanan */}
          <Link className="action-card outline" to="/services/new">
            <div className="action-card-icon-box" aria-hidden="true">
              <IconLayers size={22} />
            </div>
            <span className="action-card-title">Permohonan Layanan</span>
            <span className="action-card-arrow" aria-hidden="true">
              <IconArrowUpRight size={18} />
            </span>
          </Link>
        </div>
      </section>

      {/* 3b. Matriks Rekapitulasi Cuti Tahunan Pegawai (Legacy admin.php:270-390) */}
      {isAdmin ? (
        <section className="dashboard-block" aria-labelledby="crosstab-heading" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 id="crosstab-heading" className="block-heading" style={{ margin: 0 }}>
                Matriks Rekapitulasi Cuti Pegawai (Tahun {crosstabYear})
              </h2>
              <p className="greeting-subtitle" style={{ margin: '0.25rem 0 0' }}>
                Akumulasi durasi per jenis cuti yang disetujui (cerminan legacy admin.php)
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Cari nama/NIP..."
                value={crosstabSearch}
                onChange={(e) => setCrosstabSearch(e.target.value)}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid var(--border, #ccc)' }}
              />
              <select
                value={crosstabYear}
                onChange={(e) => setCrosstabYear(Number(e.target.value))}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.875rem', borderRadius: '6px', border: '1px solid var(--border, #ccc)' }}
              >
                {yearlySummaries.map((s) => (
                  <option key={s.year} value={s.year}>
                    Tahun {s.year}
                  </option>
                ))}
                {!yearlySummaries.some((s) => s.year === nowYear) && (
                  <option value={nowYear}>Tahun {nowYear}</option>
                )}
              </select>
            </div>
          </div>

          {selectedYearSummary ? (
            <div
              style={{
                background: '#e8f4fd',
                color: '#0b4d75',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                fontSize: '0.9rem',
                marginBottom: '1rem',
                border: '1px solid #c2e0f9',
              }}
            >
              Data Pengajuan Cuti Tahun <strong>{crosstabYear}</strong>: Total Pengajuan{' '}
              <strong>{selectedYearSummary.total}</strong>, Diterima{' '}
              <strong>{selectedYearSummary.approved}</strong>, Ditolak{' '}
              <strong>{selectedYearSummary.rejected}</strong>, Dibatalkan{' '}
              <strong>{selectedYearSummary.cancelled}</strong>.
            </div>
          ) : null}

          <div className="history-table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
            <table className="compact-history-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>No.</th>
                  <th>Nama Pegawai</th>
                  <th style={{ textAlign: 'center' }}>Cuti Tahunan (Hari)</th>
                  <th style={{ textAlign: 'center' }}>Cuti Besar (Hari)</th>
                  <th style={{ textAlign: 'center' }}>Cuti Besar (Bulan)</th>
                  <th style={{ textAlign: 'center' }}>Cuti Sakit (Hari)</th>
                  <th style={{ textAlign: 'center' }}>Cuti Sakit (Bulan)</th>
                  <th style={{ textAlign: 'center' }}>Cuti Melahirkan (Bulan)</th>
                  <th style={{ textAlign: 'center' }}>Cuti Alasan Penting (Hari)</th>
                </tr>
              </thead>
              <tbody>
                {loadingCrosstab ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: '#666' }}>
                      Memuat data matriks cuti...
                    </td>
                  </tr>
                ) : filteredCrosstab.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', padding: '1.5rem', color: '#666' }}>
                      Tidak ada data cuti yang disetujui pada tahun {crosstabYear}.
                    </td>
                  </tr>
                ) : (
                  filteredCrosstab.slice(0, 100).map((row, idx) => (
                    <tr key={`${row.name}-${idx}`}>
                      <td>{idx + 1}</td>
                      <td>
                        <strong>{row.name}</strong>
                        {row.nip ? <div style={{ fontSize: '0.75rem', color: '#666' }}>NIP. {row.nip}</div> : null}
                      </td>
                      <td style={{ textAlign: 'center' }}>{row.ct_hari || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.cb_hari || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.cb_bulan || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.cs_hari || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.cs_bulan || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.cm_bulan || 0}</td>
                      <td style={{ textAlign: 'center' }}>{row.cp_hari || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredCrosstab.length > 100 ? (
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.5rem', textAlign: 'right' }}>
              Menampilkan 100 dari {filteredCrosstab.length} pegawai. Gunakan filter pencarian untuk mempersempit.
            </p>
          ) : null}
        </section>
      ) : null}

      {/* 4. Baris Bawah: Permohonan Terakhir + Kartu Bantuan */}
      <section className="dashboard-block bottom-row-layout">
        {/* Kartu Permohonan Cuti Terakhir */}
        <div className="history-card-wrap">
          <div className="history-card-header">
            <h2 className="history-card-title">
              {isAdmin ? 'Permohonan Cuti Masuk Terakhir' : 'Permohonan Cuti Terakhir'}
            </h2>
            <Link className="view-archive-link" to="/leave">
              <span>Lihat semua arsip</span>
              <IconArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>

          {requests.length === 0 && !loading ? (
            <div className="empty-history-state">
              <div className="empty-calendar-illustration" aria-hidden="true">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#A9C9BB" strokeWidth="1.5">
                  <rect width="18" height="18" x="3" y="4" rx="2" />
                  <line x1="16" x2="16" y1="2" y2="6" />
                  <line x1="8" x2="8" y1="2" y2="6" />
                  <line x1="3" x2="21" y1="10" y2="10" />
                  <circle cx="12" cy="15" r="1.5" fill="#0E6B4C" />
                </svg>
              </div>
              <p className="empty-history-text">
                {isAdmin
                  ? 'Belum ada permohonan cuti yang masuk.'
                  : 'Belum ada riwayat permohonan cuti yang diajukan.'}
              </p>
              {!isAdmin ? (
                <Link className="btn-primary-action" to="/leave?action=new">
                  Ajukan Cuti Sekarang
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="history-table-container">
              <table className="compact-history-table">
                <thead>
                  <tr>
                    <th scope="col">Tanggal</th>
                    <th scope="col">Jenis Cuti</th>
                    <th scope="col">Durasi</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr key={item.id}>
                      <td className="cell-date">{formatDate(item.start_date)}</td>
                      <td className="cell-type">
                        <Link to={`/leave/${item.id}`} className="leave-link-cell">
                          {item.leave_type}
                        </Link>
                      </td>
                      <td className="cell-duration">
                        {item.duration} {item.duration_unit === 'day' ? 'hari' : item.duration_unit}
                      </td>
                      <td className="cell-status">
                        <span className={leaveStatusTone(item.status)}>
                          {leaveStatusLabel(item.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Kartu Bantuan (#FBF3DD) */}
        <aside className="help-card-aside" aria-labelledby="help-card-title">
          <div className="help-icon-wrap" aria-hidden="true">
            <IconHelpCircle size={28} />
          </div>
          <h2 id="help-card-title" className="help-card-title">
            Ada pertanyaan soal cuti?
          </h2>
          <p className="help-card-text">
            Baca FAQ Cuti untuk memahami aturan saldo dan alur pengajuan sebelum mengajukan.
          </p>
          <Link className="help-card-link" to="/faq">
            <span>Buka FAQ Cuti</span>
            <IconArrowRight size={16} aria-hidden="true" />
          </Link>
        </aside>
      </section>
    </div>
  );
}
