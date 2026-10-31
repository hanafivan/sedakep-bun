import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Page, QuotaCard } from '../components/Layout';
import { decisionLabel, durationUnitLabel, formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import * as api from '../api';

/**
 * Administrasi cuti — khusus admin.
 *
 * Menggabungkan panel-panel operasional yang di legacy tersebar di banyak file
 * (`pengaturan.php`, `buku_cuti.php`, `tbl_pppk_tmt`, dsb). Semua angka berasal
 * dari API; halaman ini tidak menghitung saldo sendiri.
 */

type Tab = 'approval' | 'book' | 'adjust' | 'policy' | 'pppk' | 'closure' | 'audit';

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'approval', label: 'Persetujuan admin' },
  { key: 'book', label: 'Buku cuti' },
  { key: 'adjust', label: 'Kelola kuota user' },
  { key: 'policy', label: 'Pengaturan' },
  { key: 'pppk', label: 'TMT PPPK' },
  { key: 'closure', label: 'Periode tutup' },
  { key: 'audit', label: 'Audit kuota' },
];

type PanelProps = {
  year: number;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

export function LeaveAdmin() {
  const now = new Date().getFullYear();
  const [params] = useSearchParams();
  const tabParam = params.get('tab') as Tab | null;
  const validTab = tabParam && TABS.some((item) => item.key === tabParam) ? tabParam : null;
  const [tab, setTab] = useState<Tab>(validTab ?? 'approval');
  const [year, setYear] = useState(now);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Tab bisa dipilih lewat query (?tab=pppk) — dipakai item menu "Validasi TMT PPPK".
  useEffect(() => {
    if (validTab) setTab(validTab);
  }, [validTab]);

  return (
    <Page
      title="Pengaturan Kuota Cuti"
      sub="Buku cuti, kelola kuota user, kebijakan, TMT PPPK, periode tutup, dan audit"
    >
      <div className="toolbar">
        <label htmlFor="admin-year">Tahun</label>
        <input
          id="admin-year"
          className="year"
          type="number"
          value={year}
          onChange={(event) => setYear(Number(event.target.value))}
        />
        <button className="button secondary" type="button" onClick={() => setYear(now)}>
          Tahun ini
        </button>
      </div>

      <div className="tabs">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'tab active' : 'tab'}
            onClick={() => {
              setTab(item.key);
              setError(null);
              setNotice(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {tab === 'approval' ? <ApprovalPanel year={year} onError={setError} onNotice={setNotice} /> : null}
      {tab === 'book' ? <QuotaBookPanel year={year} onError={setError} onNotice={setNotice} /> : null}
      {tab === 'adjust' ? <AdjustmentPanel year={year} onError={setError} onNotice={setNotice} /> : null}
      {tab === 'policy' ? <PolicyPanel year={year} onError={setError} onNotice={setNotice} /> : null}
      {tab === 'pppk' ? <PppkPanel year={year} onError={setError} onNotice={setNotice} /> : null}
      {tab === 'closure' ? <ClosurePanel year={year} onError={setError} onNotice={setNotice} /> : null}
      {tab === 'audit' ? <AuditPanel year={year} onError={setError} onNotice={setNotice} /> : null}
    </Page>
  );
}

/**
 * Panel persetujuan admin (approval level pertama).
 *
 * Menampilkan seluruh permohonan cuti yang masih menunggu keputusan admin
 * (`admin_decision = 'pending'`) beserta tombol Terima / Tolak inline.
 * Admin juga dapat membuka halaman detail tiap permohonan untuk informasi lebih
 * lengkap atau mencetak formulir.
 */
type ApprovalSubFilter = 'pending' | 'belum_kirim' | 'sk_belum_upload' | 'cuti_jadi' | 'rejected' | 'all';

function ApprovalPanel({ onError, onNotice }: PanelProps) {
  const navigate = useNavigate();
  const perPage = 30;
  const [filter, setFilter] = useState<ApprovalSubFilter>('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [rows, setRows] = useState<api.LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  // Map id → catatan penolakan yg sedang diketik
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const archiveFilter = filter === 'pending'
    ? 'belum_diperiksa'
    : filter === 'all'
    ? undefined
    : filter === 'rejected'
    ? 'ditolak'
    : filter;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.listLeaveRequests({
        archive: archiveFilter,
        search: search || undefined,
        page,
        per_page: perPage,
      });
      setRows(result.items);
      setTotal(result.total);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memuat permohonan');
    } finally {
      setLoading(false);
    }
  }, [archiveFilter, search, page, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (id: number, decision: 'accepted' | 'rejected') => {
    const note = notes[id] ?? '';
    if (decision === 'rejected' && !note.trim()) {
      onError('Isi catatan penolakan terlebih dahulu.');
      return;
    }
    setBusy(id);
    onError('');
    try {
      await api.decideAdmin(id, decision, note || undefined);
      onNotice(
        decision === 'accepted'
          ? `Permohonan #${id} diterima oleh admin.`
          : `Permohonan #${id} ditolak.`,
      );
      setNotes((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memproses keputusan');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>
          {filter === 'pending'
            ? 'Permohonan belum diperiksa admin (SU)'
            : filter === 'belum_kirim'
            ? 'Permohonan disetujui, formulir/SK belum dikirim'
            : filter === 'sk_belum_upload'
            ? 'Nomor SK sudah ada, berkas fisik belum diunggah'
            : filter === 'cuti_jadi'
            ? 'Cuti jadi (lengkap dengan berkas SK)'
            : filter === 'rejected'
            ? 'Permohonan ditolak'
            : 'Semua permohonan cuti'}
        </h2>
        <span className="sub">{total} permohonan</span>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button
          type="button"
          className={filter === 'pending' ? 'tab active' : 'tab'}
          onClick={() => {
            setFilter('pending');
            setPage(1);
          }}
        >
          Belum diperiksa
        </button>
        <button
          type="button"
          className={filter === 'belum_kirim' ? 'tab active' : 'tab'}
          onClick={() => {
            setFilter('belum_kirim');
            setPage(1);
          }}
        >
          Formulir belum dikirim
        </button>
        <button
          type="button"
          className={filter === 'sk_belum_upload' ? 'tab active' : 'tab'}
          onClick={() => {
            setFilter('sk_belum_upload');
            setPage(1);
          }}
        >
          SK belum diunggah
        </button>
        <button
          type="button"
          className={filter === 'cuti_jadi' ? 'tab active' : 'tab'}
          onClick={() => {
            setFilter('cuti_jadi');
            setPage(1);
          }}
        >
          Cuti jadi
        </button>
        <button
          type="button"
          className={filter === 'rejected' ? 'tab active' : 'tab'}
          onClick={() => {
            setFilter('rejected');
            setPage(1);
          }}
        >
          Ditolak
        </button>
        <button
          type="button"
          className={filter === 'all' ? 'tab active' : 'tab'}
          onClick={() => {
            setFilter('all');
            setPage(1);
          }}
        >
          Semua
        </button>
      </div>

      <div className="toolbar">
        <input
          placeholder="Cari nama atau NIP"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage(1);
              setSearch(searchInput);
            }
          }}
        />
        <button
          className="button secondary small"
          type="button"
          onClick={() => {
            setPage(1);
            setSearch(searchInput);
          }}
        >
          Cari
        </button>
        <button className="button secondary small" type="button" onClick={() => void load()}>
          Muat ulang
        </button>
      </div>

      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && rows.length === 0 ? (
        <p className="sub">
          {filter === 'pending'
            ? 'Tidak ada permohonan yang menunggu persetujuan admin.'
            : filter === 'cuti_jadi'
            ? 'Tidak ada permohonan yang berstatus cuti jadi.'
            : 'Tidak ada permohonan ditemukan.'}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Nama / NIP</th>
                <th>Jenis cuti</th>
                <th>Tanggal</th>
                <th>Durasi</th>
                <th>Status</th>
                <th>Catatan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button
                      className="link small"
                      type="button"
                      title="Buka halaman detail"
                      onClick={() => navigate(`/leave/${row.id}`)}
                    >
                      #{row.id}
                    </button>
                  </td>
                  <td>
                    <span>{row.name}</span>
                    {row.nip ? <span className="sub"> {row.nip}</span> : null}
                  </td>
                  <td>{row.leave_type}</td>
                  <td>
                    {formatDate(row.start_date)}
                    {row.start_date !== row.end_date ? ` – ${formatDate(row.end_date)}` : ''}
                  </td>
                  <td>
                    {row.duration} {durationUnitLabel(row.duration_unit)}
                  </td>
                  <td>
                    <span className={`badge ${leaveStatusTone(row.status)}`}>
                      {leaveStatusLabel(row.status)}
                    </span>
                    {' / '}
                    <span className="sub">{decisionLabel(row.admin_decision)}</span>
                  </td>
                  <td>
                    {row.admin_decision === 'pending' ? (
                      <input
                        style={{ width: '100%', minWidth: '140px' }}
                        placeholder="Catatan (wajib jika tolak)"
                        value={notes[row.id] ?? ''}
                        onChange={(event) =>
                          setNotes((prev) => ({ ...prev, [row.id]: event.target.value }))
                        }
                      />
                    ) : (
                      <span className="sub">{row.rejection_reason ?? '-'}</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {row.admin_decision === 'pending' ? (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          type="button"
                          className="button small primary"
                          title="Periksa permohonan lengkap dan konfirmasi kuota"
                          onClick={() => navigate(`/leave/${row.id}`)}
                        >
                          Periksa
                        </button>
                        <button
                          type="button"
                          className="button small"
                          disabled={busy === row.id}
                          onClick={() => void decide(row.id, 'accepted')}
                        >
                          Terima
                        </button>
                        <button
                          type="button"
                          className="button danger small"
                          disabled={busy === row.id}
                          onClick={() => void decide(row.id, 'rejected')}
                        >
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="button secondary small"
                        onClick={() => navigate(`/leave/${row.id}`)}
                      >
                        Detail
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button
              className="button secondary small"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Sebelumnya
            </button>
            <span>Halaman {page}</span>
            <button
              className="button secondary small"
              type="button"
              disabled={rows.length < perPage}
              onClick={() => setPage((value) => value + 1)}
            >
              Berikutnya
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Buku cuti: projection saldo seluruh pegawai untuk satu tahun. */
function QuotaBookPanel({ year, onError, onNotice }: PanelProps) {
  const perPage = 50;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<api.QuotaBookRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getQuotaBook({
        year,
        search: search || undefined,
        page,
        per_page: perPage,
      });
      setRows(result.items);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memuat buku cuti');
    } finally {
      setLoading(false);
    }
  }, [year, search, page, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const rebuildAll = async () => {
    if (!window.confirm(`Rebuild projection kuota ${year} untuk semua pegawai?`)) return;
    setBusy(true);
    onNotice('');
    try {
      await api.rebuildQuota({ year, all_users: true });
      await load();
      onNotice(`Projection ${year} selesai dibangun ulang.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Rebuild gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Buku cuti {year}</h2>
        <button className="button secondary small" type="button" disabled={busy} onClick={() => void rebuildAll()}>
          {busy ? 'Membangun...' : 'Rebuild semua pegawai'}
        </button>
      </div>
      <div className="toolbar">
        <input
          placeholder="Cari nama, NIP, atau id"
          defaultValue={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage(1);
              setSearch((event.target as HTMLInputElement).value);
            }
          }}
        />
      </div>

      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && rows.length === 0 ? <p className="sub">Tidak ada baris untuk filter ini.</p> : null}

      {rows.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NIP</th>
                <th>Unit</th>
                <th>Sisa N</th>
                <th>Sisa N-1</th>
                <th>Sisa N-2</th>
                <th>Total</th>
                <th>Terpesan</th>
                <th>Layak</th>
                <th>Dibangun</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id}>
                  <td>{row.name}</td>
                  <td>{row.nip ?? '-'}</td>
                  <td>{row.unit_name ?? '-'}</td>
                  <td>{row.remaining_n}</td>
                  <td>{row.remaining_n1}</td>
                  <td>{row.remaining_n2}</td>
                  <td>{row.total_remaining}</td>
                  <td>{row.reserved_days}</td>
                  <td>
                    <span className={row.eligible ? 'badge ok' : 'badge muted'}>
                      {row.eligible ? 'Ya' : 'Tidak'}
                    </span>
                  </td>
                  <td>{row.computed_at ? formatDate(row.computed_at) : '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Link
                        to={`/leave?tab=history&user_id=${row.user_id}`}
                        className="button secondary small"
                      >
                        Riwayat
                      </Link>
                      <Link
                        to={`/quota/print/${row.user_id}`}
                        target="_blank"
                        className="button secondary small"
                      >
                        Cetak
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button
              className="button secondary small"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              Sebelumnya
            </button>
            <span>Halaman {page}</span>
            <button
              className="button secondary small"
              type="button"
              disabled={rows.length < perPage}
              onClick={() => setPage((value) => value + 1)}
            >
              Berikutnya
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

/** Penyesuaian kuota manual + validasi manual + rebuild per pegawai. */
function AdjustmentPanel({ year, onError, onNotice }: PanelProps) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<api.AdminUserRow[]>([]);
  const [selected, setSelected] = useState<api.AdminUserRow | null>(null);
  const [quota, setQuota] = useState<api.Quota | null>(null);
  const [rows, setRows] = useState<api.QuotaAdjustment[]>([]);
  const [days, setDays] = useState(1);
  const [reason, setReason] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [busy, setBusy] = useState(false);

  const findUsers = async () => {
    try {
      const result = await api.listAdminUsers({ search: search || undefined, per_page: 15 });
      setUsers(result.items);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal mencari pegawai');
    }
  };

  const loadDetail = useCallback(
    async (user: api.AdminUserRow) => {
      try {
        const [quotaData, adjustments] = await Promise.all([
          api.getQuotaFor(user.id, year),
          api.listQuotaAdjustments(user.id, year),
        ]);
        setQuota(quotaData);
        setRows(adjustments);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Gagal memuat kuota pegawai');
      }
    },
    [year, onError],
  );

  useEffect(() => {
    if (selected) void loadDetail(selected);
  }, [selected, loadDetail]);

  const add = async () => {
    if (!selected || days === 0) return;
    setBusy(true);
    try {
      await api.createQuotaAdjustment({
        user_id: selected.id,
        year,
        days,
        reason: reason || undefined,
      });
      onNotice(`Penyesuaian ${days} hari tersimpan untuk ${selected.name}.`);
      setDays(1);
      setReason('');
      await loadDetail(selected);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menyimpan penyesuaian');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: api.QuotaAdjustment) => {
    if (!window.confirm(`Hapus penyesuaian ${row.days} hari?`)) return;
    try {
      await api.deleteQuotaAdjustment(row.id, row.user_id, row.year);
      if (selected) await loadDetail(selected);
      onNotice('Penyesuaian dihapus.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menghapus penyesuaian');
    }
  };

  const rebuild = async () => {
    if (!selected) return;
    try {
      await api.rebuildQuotaFor(selected.id, year);
      await loadDetail(selected);
      onNotice(`Projection ${selected.name} dibangun ulang.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Rebuild gagal');
    }
  };

  const setOverride = async (active: boolean) => {
    if (!selected) return;
    try {
      await api.setEligibilityOverride({
        user_id: selected.id,
        year,
        active,
        reason: overrideReason || undefined,
      });
      await loadDetail(selected);
      onNotice(active ? 'Validasi manual diaktifkan.' : 'Validasi manual dibatalkan.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menyimpan validasi manual');
    }
  };

  return (
    <div className="split">
      <div className="panel">
        <h2>Cari pegawai</h2>
        <div className="toolbar">
          <input
            placeholder="Nama atau NIP"
            defaultValue={search}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void findUsers();
            }}
          />
          <button className="button secondary small" type="button" onClick={() => void findUsers()}>
            Cari
          </button>
        </div>

        {users.length === 0 ? <p className="sub">Ketik nama/NIP lalu tekan Cari.</p> : null}
        {users.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NIP</th>
                <th>Unit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.name}</td>
                  <td>{user.nip ?? '-'}</td>
                  <td>{user.unit_name ?? '-'}</td>
                  <td>
                    <button
                      className="button secondary small"
                      type="button"
                      onClick={() => setSelected(user)}
                    >
                      Pilih
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="panel">
        <h2>Penyesuaian kuota</h2>
        {!selected ? (
          <p className="sub">Pilih pegawai terlebih dahulu.</p>
        ) : (
          <>
            <p className="sub">
              {selected.name} · {selected.nip ?? '-'} · {selected.unit_name ?? '-'}
            </p>

            {quota ? (
              <div className="stats">
                <QuotaCard label="Available" value={quota.available.total} tone="ok" />
                <QuotaCard
                  label="Reserved"
                  value={quota.reserved_days}
                  hint={`${quota.reserved_count} permohonan`}
                  tone={quota.reserved_days > 0 ? 'warn' : undefined}
                />
              </div>
            ) : null}

            <div className="grid2">
              <div>
                <label>Hari (+/−)</label>
                <input
                  type="number"
                  value={days}
                  onChange={(event) => setDays(Number(event.target.value))}
                />
              </div>
              <div>
                <label>Alasan</label>
                <input value={reason} onChange={(event) => setReason(event.target.value)} />
              </div>
            </div>
            <div className="actions">
              <button className="button" type="button" disabled={busy || days === 0} onClick={() => void add()}>
                Tambah penyesuaian
              </button>
              <button className="button secondary" type="button" onClick={() => void rebuild()}>
                Rebuild kuota
              </button>
            </div>

            <h3>Riwayat penyesuaian {year}</h3>
            {rows.length === 0 ? <p className="sub">Belum ada penyesuaian.</p> : null}
            {rows.length > 0 ? (
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Hari</th>
                    <th>Alasan</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.days}</td>
                      <td>{row.reason ?? '-'}</td>
                      <td>
                        <button
                          className="button danger small"
                          type="button"
                          onClick={() => void remove(row)}
                        >
                          Hapus
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <h3>Validasi manual kelayakan</h3>
            <label>Alasan override</label>
            <input
              value={overrideReason}
              onChange={(event) => setOverrideReason(event.target.value)}
            />
            <div className="actions">
              <button className="button secondary" type="button" onClick={() => void setOverride(true)}>
                Aktifkan
              </button>
              <button className="button secondary" type="button" onClick={() => void setOverride(false)}>
                Batalkan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Kebijakan/SK kuota per tahun + rollover carry-over. */
function PolicyPanel({ year, onError, onNotice }: PanelProps) {
  const [form, setForm] = useState({
    default_days: 12,
    carry_over_max_n1: 6,
    carry_over_max_n2: 6,
    min_service_months: 12,
    notes: '',
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const policy = (await api.getLeavePolicy(year)) as Record<string, unknown>;
        if (!alive) return;
        setForm({
          default_days: Number(policy.default_days ?? 12),
          carry_over_max_n1: Number(policy.carry_over_max_n1 ?? 6),
          carry_over_max_n2: Number(policy.carry_over_max_n2 ?? 6),
          min_service_months: Number(policy.min_service_months ?? 12),
          notes: policy.notes ? String(policy.notes) : '',
        });
      } catch (err) {
        if (alive) onError(err instanceof Error ? err.message : 'Gagal memuat kebijakan');
      }
    })();
    return () => {
      alive = false;
    };
  }, [year, onError]);

  const save = async () => {
    if (!window.confirm(`Terapkan kebijakan kuota ${year}? Perubahan langsung dipakai engine.`))
      return;
    setBusy(true);
    try {
      await api.applyLeavePolicy({ year, ...form, confirm: true });
      onNotice(`Kebijakan ${year} diterapkan.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menerapkan kebijakan');
    } finally {
      setBusy(false);
    }
  };

  const rollover = async () => {
    if (!window.confirm(`Rollover carry-over dari ${year - 1} ke ${year}?`)) return;
    setBusy(true);
    try {
      const result = await api.rolloverQuota(year);
      onNotice(`Rollover ${year}: ${result.success} berhasil, ${result.failed} gagal.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Rollover gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <h2>Kebijakan kuota {year}</h2>
      <p className="sub">
        Jatah default, batas carry-over N-1/N-2, dan masa kerja minimum. Tahun yang sudah
        diterapkan butuh konfirmasi untuk ditimpa.
      </p>

      <div className="grid2">
        <div>
          <label>Jatah default (hari)</label>
          <input
            type="number"
            value={form.default_days}
            onChange={(event) => setForm({ ...form, default_days: Number(event.target.value) })}
          />
        </div>
        <div>
          <label>Masa kerja minimum (bulan)</label>
          <input
            type="number"
            value={form.min_service_months}
            onChange={(event) =>
              setForm({ ...form, min_service_months: Number(event.target.value) })
            }
          />
        </div>
        <div>
          <label>Batas carry-over N-1</label>
          <input
            type="number"
            value={form.carry_over_max_n1}
            onChange={(event) =>
              setForm({ ...form, carry_over_max_n1: Number(event.target.value) })
            }
          />
        </div>
        <div>
          <label>Batas carry-over N-2</label>
          <input
            type="number"
            value={form.carry_over_max_n2}
            onChange={(event) =>
              setForm({ ...form, carry_over_max_n2: Number(event.target.value) })
            }
          />
        </div>
      </div>

      <label>Catatan</label>
      <textarea
        rows={2}
        value={form.notes}
        onChange={(event) => setForm({ ...form, notes: event.target.value })}
      />

      <div className="actions">
        <button className="button" type="button" disabled={busy} onClick={() => void save()}>
          Terapkan kebijakan
        </button>
        <button className="button secondary" type="button" disabled={busy} onClick={() => void rollover()}>
          Rollover ke {year}
        </button>
      </div>
    </div>
  );
}

/** TMT PPPK: yang sudah tercatat dan yang masih kosong. */
function PppkPanel({ onError, onNotice }: PanelProps) {
  const [data, setData] = useState<{
    recorded: api.PppkTmtRecorded[];
    missing: api.PppkTmtMissing[];
  }>({ recorded: [], missing: [] });
  const [dates, setDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.getPppkTmt());
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memuat TMT PPPK');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (nip: string) => {
    try {
      await api.setPppkTmt(nip, dates[nip] || null);
      onNotice(`TMT ${nip} tersimpan.`);
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menyimpan TMT');
    }
  };

  const clear = async (nip: string) => {
    if (!window.confirm(`Hapus TMT untuk ${nip}?`)) return;
    try {
      await api.setPppkTmt(nip, null);
      onNotice('TMT dihapus.');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menghapus TMT');
    }
  };

  return (
    <>
      <div className="panel">
        <h2>TMT PPPK tercatat</h2>
        {loading ? <p className="sub">Memuat...</p> : null}
        {!loading && data.recorded.length === 0 ? <p className="sub">Belum ada TMT tercatat.</p> : null}
        {data.recorded.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NIP</th>
                <th>TMT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.recorded.map((row) => (
                <tr key={row.nip}>
                  <td>{row.name ?? '-'}</td>
                  <td>{row.nip}</td>
                  <td>{formatDate(row.tmt_date)}</td>
                  <td>
                    <button className="button danger small" type="button" onClick={() => void clear(row.nip)}>
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="panel">
        <h2>PPPK belum punya TMT</h2>
        {!loading && data.missing.length === 0 ? (
          <p className="sub">Semua PPPK sudah punya TMT.</p>
        ) : null}
        {data.missing.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th>Nama</th>
                <th>NIP</th>
                <th>Unit</th>
                <th>Tanggal TMT</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.missing.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.nip ?? '-'}</td>
                  <td>{row.unit_name ?? '-'}</td>
                  <td>
                    <input
                      type="date"
                      value={row.nip ? dates[row.nip] ?? '' : ''}
                      disabled={!row.nip}
                      onChange={(event) => {
                        if (row.nip) setDates({ ...dates, [row.nip]: event.target.value });
                      }}
                    />
                  </td>
                  <td>
                    <button
                      className="button secondary small"
                      type="button"
                      disabled={!row.nip || !dates[row.nip]}
                      onClick={() => {
                        if (row.nip) void save(row.nip);
                      }}
                    >
                      Simpan
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>
    </>
  );
}

/** Periode tutup pengajuan cuti tahunan. */
function ClosurePanel({ year, onError, onNotice }: PanelProps) {
  const [periods, setPeriods] = useState<api.ClosurePeriod[]>([]);
  const [form, setForm] = useState({ start_date: '', end_date: '', message: '' });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPeriods(await api.listClosurePeriods());
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memuat periode tutup');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!form.start_date || !form.end_date) {
      onError('Tanggal mulai dan selesai wajib diisi.');
      return;
    }
    try {
      await api.createClosurePeriod({
        year,
        start_date: form.start_date,
        end_date: form.end_date,
        enabled: true,
        message: form.message || undefined,
      });
      setForm({ start_date: '', end_date: '', message: '' });
      onNotice('Periode tutup dibuat.');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal membuat periode tutup');
    }
  };

  const toggle = async (period: api.ClosurePeriod) => {
    try {
      await api.updateClosurePeriod(period.id, { enabled: !period.enabled });
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal mengubah periode tutup');
    }
  };

  const remove = async (period: api.ClosurePeriod) => {
    if (!window.confirm('Hapus periode tutup ini?')) return;
    try {
      await api.deleteClosurePeriod(period.id);
      onNotice('Periode tutup dihapus.');
      await load();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menghapus periode tutup');
    }
  };

  return (
    <div className="panel">
      <h2>Periode tutup {year}</h2>
      <p className="sub">Pengajuan cuti tahunan di dalam periode aktif akan ditolak.</p>

      <div className="grid2">
        <div>
          <label>Mulai</label>
          <input
            type="date"
            value={form.start_date}
            onChange={(event) => setForm({ ...form, start_date: event.target.value })}
          />
        </div>
        <div>
          <label>Selesai</label>
          <input
            type="date"
            value={form.end_date}
            onChange={(event) => setForm({ ...form, end_date: event.target.value })}
          />
        </div>
      </div>
      <label>Pesan</label>
      <input value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
      <div className="actions">
        <button className="button" type="button" onClick={() => void create()}>
          Tambah periode
        </button>
      </div>

      <h3>Daftar periode</h3>
      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && periods.length === 0 ? <p className="sub">Belum ada periode tutup.</p> : null}
      {periods.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Tahun</th>
              <th>Mulai</th>
              <th>Selesai</th>
              <th>Status</th>
              <th>Pesan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period.id}>
                <td>{period.year}</td>
                <td>{formatDate(period.start_date)}</td>
                <td>{formatDate(period.end_date)}</td>
                <td>
                  <span className={period.enabled ? 'badge ok' : 'badge muted'}>
                    {period.enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>{period.message ?? '-'}</td>
                <td>
                  <button className="button secondary small" type="button" onClick={() => void toggle(period)}>
                    {period.enabled ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>{' '}
                  <button className="button danger small" type="button" onClick={() => void remove(period)}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

/** Audit mutasi kuota lintas pegawai. */
function AuditPanel({ year, onError }: PanelProps) {
  const [action, setAction] = useState('');
  const [rows, setRows] = useState<api.QuotaAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.getQuotaAuditTrail({ year, action: action || undefined, limit: 200 }));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memuat audit kuota');
    } finally {
      setLoading(false);
    }
  }, [year, action, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="panel">
      <h2>Audit kuota {year}</h2>
      <div className="toolbar">
        <input
          placeholder="Filter aksi (mis. leave_policy_apply)"
          defaultValue={action}
          onKeyDown={(event) => {
            if (event.key === 'Enter') setAction((event.target as HTMLInputElement).value);
          }}
        />
      </div>

      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && rows.length === 0 ? <p className="sub">Tidak ada catatan.</p> : null}
      {rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pegawai</th>
              <th>Aksi</th>
              <th>Selisih</th>
              <th>Alasan</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatDate(row.created_at)}</td>
                <td>{row.user_name ?? row.user_id}</td>
                <td>{row.action}</td>
                <td>{row.difference ?? '-'}</td>
                <td>{row.reason ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
