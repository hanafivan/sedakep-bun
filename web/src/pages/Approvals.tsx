import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import * as api from '../api';
import { useAuth } from '../auth';
import {
  IconCheckSquare,
  IconFileText,
  IconPrinter,
  IconUser,
} from '../components/Icons';
import { LeaveFormModal } from '../components/LeaveFormModal';
import { LeaveSkModal } from '../components/LeaveSkModal';
import { LeaveDecisionModal } from '../components/LeaveDecisionModal';

/**
 * Hub Persetujuan Cuti Berjenjang (Atasan 1, Atasan 2, Admin):
 *
 * Menampilkan antrean persetujuan berjenjang sesuai hierarki BKN:
 * - Atasan 1: Pertimbangan Atasan Langsung
 * - Atasan 2: Keputusan Pejabat yang Berwenang Memberikan Cuti
 * - Admin: Verifikasi kuota dan kelengkapan administrasi
 * - Dilengkapi toggle "Ditugaskan ke Saya" untuk Atasan sehingga langsung
 *   menyaring permohonan yang dialamatkan ke NIP mereka.
 * - Dilengkapi modal pratinjau Formulir BKN, SK, dan modal keputusan langsung.
 */

export type ApprovalQueue =
  | 'all_pending'
  | 'atasan_1'
  | 'atasan_2'
  | 'admin'
  | 'approved'
  | 'all';

interface QueueTabConfig {
  key: ApprovalQueue;
  label: string;
  description: string;
}

const QUEUE_TABS: QueueTabConfig[] = [
  { key: 'all_pending', label: 'Semua Menunggu', description: 'Semua permohonan yang sedang dalam proses persetujuan' },
  { key: 'atasan_1', label: 'Pertimbangan Atasan 1', description: 'Menunggu pertimbangan dari atasan langsung' },
  { key: 'atasan_2', label: 'Keputusan Pejabat (Atasan 2)', description: 'Menunggu keputusan dari pejabat yang berwenang memberikan cuti' },
  { key: 'admin', label: 'Verifikasi Admin', description: 'Menunggu verifikasi administrasi dan kuota oleh tim kepegawaian' },
  { key: 'approved', label: 'Sudah Disetujui (Cuti Jadi)', description: 'Permohonan yang telah disetujui penuh oleh seluruh pejabat' },
  { key: 'all', label: 'Semua Arsip', description: 'Seluruh riwayat permohonan cuti kantor' },
];

export function ApprovalsPanel({
  onTotalPendingChange,
}: {
  onTotalPendingChange?: (count: number) => void;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const isStaff = user?.role === 'admin' || user?.role === 'atasan' || user?.role === 'verifikator';
  const hasNip = Boolean(user?.nip);

  // Baca queue aktif dari URL query atau default
  const paramQueue = params.get('queue') as ApprovalQueue | null;
  const initialQueue: ApprovalQueue =
    paramQueue && QUEUE_TABS.some((t) => t.key === paramQueue)
      ? paramQueue
      : 'all_pending';

  const [queue, setQueue] = useState<ApprovalQueue>(initialQueue);

  // Filter "Ditugaskan ke Saya": default false agar seluruh antrean terlihat jelas,
  // pengguna dapat mengaktifkan filter NIP kapan saja via toggle
  const [assignedToMe, setAssignedToMe] = useState<boolean>(() => {
    return params.get('assigned') === 'true';
  });

  const perPage = 25;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [items, setItems] = useState<api.LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Summary badge counters
  const [summary, setSummary] = useState<api.ApprovalSummary | null>(null);

  // Modals state
  const [previewFormId, setPreviewFormId] = useState<number | null>(null);
  const [previewSkId, setPreviewSkId] = useState<number | null>(null);
  const [decisionItem, setDecisionItem] = useState<api.LeaveRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Muat ringkasan badge antrean
  const loadSummary = useCallback(async () => {
    try {
      const res = await api.getApprovalSummary({ approver_nip: user?.nip || undefined });
      setSummary(res);
      if (onTotalPendingChange) {
        onTotalPendingChange(res.all_pending);
      }
    } catch {
      // Abaikan bila modul belum siap
    }
  }, [user?.nip, onTotalPendingChange]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  // Muat daftar permohonan sesuai queue & filter
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const approverNip = assignedToMe && user?.nip ? user.nip : undefined;

      let statusParam: string | undefined;
      let adminDecisionParam: string | undefined;
      let approverLevelParam: 1 | 2 | undefined;
      let approverStatusParam: 'pending' | 'accepted' | 'rejected' | undefined;

      switch (queue) {
        case 'all_pending':
          statusParam = 'submitted,in_review';
          break;
        case 'atasan_1':
          approverLevelParam = 1;
          approverStatusParam = 'pending';
          break;
        case 'atasan_2':
          approverLevelParam = 2;
          approverStatusParam = 'pending';
          break;
        case 'admin':
          adminDecisionParam = 'pending';
          statusParam = 'submitted,in_review';
          break;
        case 'approved':
          statusParam = 'approved';
          break;
        case 'all':
          // Tidak ada filter status
          break;
      }

      const list = await api.listLeaveRequests({
        status: statusParam,
        admin_decision: adminDecisionParam,
        approver_level: approverLevelParam,
        approver_status: approverStatusParam,
        approver_nip: approverNip,
        search: search || undefined,
        page,
        per_page: perPage,
      });

      setItems(list.items);
      setTotal(list.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat permohonan cuti');
    } finally {
      setLoading(false);
    }
  }, [queue, assignedToMe, user?.nip, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Sinkronkan state queue bila URL query param queue berubah dari luar
  useEffect(() => {
    const q = params.get('queue') as ApprovalQueue | null;
    if (q && QUEUE_TABS.some((t) => t.key === q) && q !== queue) {
      setQueue(q);
      setPage(1);
    }
  }, [params, queue]);

  // Sinkronisasi queue tab ke URL search params
  const handleQueueChange = (nextQueue: ApprovalQueue) => {
    setQueue(nextQueue);
    setPage(1);
    const nextParams = new URLSearchParams(params);
    nextParams.set('queue', nextQueue);
    setParams(nextParams, { replace: true });
  };

  const handleAssignedToggle = (toMe: boolean) => {
    setAssignedToMe(toMe);
    setPage(1);
    const nextParams = new URLSearchParams(params);
    nextParams.set('assigned', String(toMe));
    setParams(nextParams, { replace: true });
  };

  const onSearchSubmit = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  // Helper untuk mendapatkan angka badge per tab
  const getBadgeCount = (key: ApprovalQueue): number => {
    if (!summary) return 0;
    switch (key) {
      case 'all_pending':
        return assignedToMe && user?.nip ? summary.my_pending : summary.all_pending;
      case 'atasan_1':
        return assignedToMe && user?.nip ? summary.my_atasan_1 : summary.atasan_1;
      case 'atasan_2':
        return assignedToMe && user?.nip ? summary.my_atasan_2 : summary.atasan_2;
      case 'admin':
        return summary.admin;
      case 'approved':
        return summary.approved;
      default:
        return 0;
    }
  };

  const handleDecisionSuccess = (msg: string) => {
    setToastMessage(msg);
    void load();
    void loadSummary();
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage ? (
        <div
          className="app-toast"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            background: '#0E6B4C',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          <span>✓</span>
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#fff',
              cursor: 'pointer',
              marginLeft: 8,
              fontSize: '16px',
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {/* Sub-Tabs Antrean Persetujuan */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {QUEUE_TABS.map((tab) => {
          const badge = getBadgeCount(tab.key);
          const isActive = queue === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              className={isActive ? 'tab active' : 'tab'}
              onClick={() => handleQueueChange(tab.key)}
              title={tab.description}
            >
              {tab.label}
              {badge > 0 ? (
                <span
                  className={isActive ? 'badge ok' : 'badge warn'}
                  style={{ marginLeft: 6, fontSize: '11px', padding: '1px 7px' }}
                >
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Toolbar Filter & Pencarian */}
      <div className="toolbar" style={{ flexWrap: 'wrap', gap: 10 }}>
        {/* Smart Filter: Ditugaskan ke Saya vs Semua */}
        {hasNip ? (
          <div
            style={{
              display: 'inline-flex',
              borderRadius: 8,
              background: '#f1f5f9',
              padding: 3,
              border: '1px solid #e2e8f0',
              marginRight: 6,
            }}
          >
            <button
              type="button"
              className={assignedToMe ? 'button small primary' : 'button small secondary'}
              style={{
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: '12.5px',
                margin: 0,
                fontWeight: assignedToMe ? 600 : 500,
              }}
              onClick={() => handleAssignedToggle(true)}
              title={`Hanya tampilkan permohonan yang ditugaskan ke NIP ${user?.nip}`}
            >
              <IconUser size={14} style={{ display: 'inline', verticalAlign: '-2px', marginRight: 4 }} />
              Ditugaskan ke Saya ({user?.nip})
            </button>
            <button
              type="button"
              className={!assignedToMe ? 'button small primary' : 'button small secondary'}
              style={{
                borderRadius: 6,
                padding: '4px 12px',
                fontSize: '12.5px',
                margin: 0,
                fontWeight: !assignedToMe ? 600 : 500,
              }}
              onClick={() => handleAssignedToggle(false)}
            >
              Semua Pegawai
            </button>
          </div>
        ) : null}

        <input
          placeholder="Cari nama pemohon, NIP, atau ID..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearchSubmit();
          }}
          style={{ maxWidth: 300 }}
        />
        <button className="button secondary" type="button" onClick={onSearchSubmit}>
          Cari
        </button>
        <button
          className="button secondary"
          type="button"
          onClick={() => {
            setSearchInput('');
            setSearch('');
            setPage(1);
          }}
        >
          Reset
        </button>
        <span className="sub" style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: '13px' }}>
          {total} permohonan
        </span>
      </div>

      {loading ? <p className="sub">Memuat data antrean persetujuan...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <IconCheckSquare size={32} />
          </div>
          <p style={{ fontWeight: 500, margin: '8px 0 4px' }}>
            {queue === 'atasan_1'
              ? assignedToMe
                ? 'Tidak ada permohonan cuti yang menunggu pertimbangan Anda (Atasan 1).'
                : 'Tidak ada permohonan yang menunggu pertimbangan Atasan 1.'
              : queue === 'atasan_2'
              ? assignedToMe
                ? 'Tidak ada permohonan cuti yang menunggu keputusan Anda (Atasan 2).'
                : 'Tidak ada permohonan yang menunggu keputusan Pejabat (Atasan 2).'
              : queue === 'admin'
              ? 'Tidak ada permohonan cuti yang menunggu verifikasi admin.'
              : queue === 'approved'
              ? 'Belum ada permohonan cuti yang berstatus disetujui (cuti jadi).'
              : 'Tidak ada permohonan cuti yang cocok dengan kriteria filter saat ini.'}
          </p>
          <span className="sub" style={{ fontSize: '12.5px' }}>
            {assignedToMe ? 'Anda dapat beralih ke tab "Semua Pegawai" untuk melihat permohonan lainnya.' : ''}
          </span>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Nama / NIP</th>
                  <th>Jenis Cuti</th>
                  <th>Tanggal</th>
                  <th>Durasi</th>
                  <th>Atasan 1 (Pertimbangan)</th>
                  <th>Atasan 2 (Keputusan)</th>
                  <th>Admin</th>
                  <th>Status Final</th>
                  <th>Nomor SK</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const needsDecision =
                    item.status === 'submitted' || item.status === 'in_review';
                  const isMyPending =
                    user?.nip &&
                    ((item.approver_1_nip === user.nip && item.approver_1_status === 'pending') ||
                      (item.approver_2_nip === user.nip &&
                        item.approver_1_status === 'accepted' &&
                        item.approver_2_status === 'pending'));

                  return (
                    <tr
                      key={item.id}
                      style={{
                        backgroundColor: isMyPending ? 'rgba(14, 107, 76, 0.04)' : undefined,
                      }}
                    >
                      <td>
                        <Link to={`/leave/${item.id}`} className="mono">
                          #{item.id}
                        </Link>
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                        {item.nip ? <div className="sub mono" style={{ fontSize: '11.5px' }}>{item.nip}</div> : null}
                      </td>
                      <td>{item.leave_type}</td>
                      <td>
                        {formatDate(item.start_date)}
                        {item.start_date !== item.end_date ? ` – ${formatDate(item.end_date)}` : ''}
                      </td>
                      <td>
                        {item.duration} {item.duration_unit}
                      </td>
                      <td>
                        <span className={leaveStatusTone(item.approver_1_status)}>
                          {leaveStatusLabel(item.approver_1_status)}
                        </span>
                        {item.approver_1_name ? (
                          <div className="sub" style={{ fontSize: '11px', marginTop: 2 }} title={item.approver_1_position ?? undefined}>
                            {item.approver_1_name}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className={leaveStatusTone(item.approver_2_status)}>
                          {leaveStatusLabel(item.approver_2_status)}
                        </span>
                        {item.approver_2_name ? (
                          <div className="sub" style={{ fontSize: '11px', marginTop: 2 }} title={item.approver_2_position ?? undefined}>
                            {item.approver_2_name}
                          </div>
                        ) : null}
                        {item.approver_1_status === 'pending' && item.approver_2_status === 'pending' ? (
                          <div style={{ fontSize: '10.5px', color: '#b45309', marginTop: 2, fontStyle: 'italic' }}>
                            (Menunggu Atasan 1)
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <span className={leaveStatusTone(item.admin_decision)}>
                          {leaveStatusLabel(item.admin_decision)}
                        </span>
                      </td>
                      <td>
                        <span className={leaveStatusTone(item.status)}>
                          {leaveStatusLabel(item.status)}
                        </span>
                      </td>
                      <td>
                        {item.letter_number ? (
                          <span style={{ color: '#047857', fontWeight: 600, fontSize: '12.5px' }}>
                            {item.letter_number}
                          </span>
                        ) : (
                          <span className="sub">-</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          {/* Modal Pratinjau Formulir BKN */}
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() => setPreviewFormId(item.id)}
                            title="Pratinjau / Cetak Formulir Cuti BKN"
                          >
                            <IconFileText size={13} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                            Form
                          </button>

                          {/* Modal Pratinjau SK Cuti bila ada */}
                          {item.letter_number || item.status === 'approved' ? (
                            <button
                              type="button"
                              className="button secondary small"
                              onClick={() => setPreviewSkId(item.id)}
                              title="Pratinjau / Cetak SK Cuti"
                            >
                              <IconPrinter size={13} style={{ display: 'inline', verticalAlign: '-1px', marginRight: 3 }} />
                              SK
                            </button>
                          ) : null}

                          {/* Tombol Putuskan Modal Cepat */}
                          {needsDecision && isStaff ? (
                            <button
                              type="button"
                              className={isMyPending ? 'button small ok' : 'button small primary'}
                              style={{ fontWeight: 600 }}
                              onClick={() => setDecisionItem(item)}
                              title="Putuskan langsung melalui modal popup"
                            >
                              Putuskan
                            </button>
                          ) : null}

                          {/* Link ke Halaman Detail Penuh */}
                          <button
                            type="button"
                            className="button secondary small"
                            onClick={() => navigate(`/leave/${item.id}`)}
                            title="Buka detail lengkap permohonan"
                          >
                            Detail
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pager" style={{ marginTop: 16 }}>
            <button
              className="button secondary small"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Sebelumnya
            </button>
            <span className="pager-info">
              Halaman {page} dari {Math.ceil(total / perPage) || 1} ({total} permohonan)
            </span>
            <button
              className="button secondary small"
              type="button"
              disabled={items.length < perPage || page * perPage >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Berikutnya →
            </button>
          </div>
        </>
      ) : null}

      {/* Modal Pratinjau Formulir Cuti BKN */}
      <LeaveFormModal
        requestId={previewFormId}
        isOpen={previewFormId !== null}
        onClose={() => setPreviewFormId(null)}
      />

      {/* Modal Pratinjau SK Cuti */}
      <LeaveSkModal
        requestId={previewSkId}
        isOpen={previewSkId !== null}
        onClose={() => setPreviewSkId(null)}
      />

      {/* Modal Putuskan Permohonan (Atasan 1, Atasan 2, Admin) */}
      <LeaveDecisionModal
        request={decisionItem}
        defaultLevel={queue === 'atasan_1' ? 1 : queue === 'atasan_2' ? 2 : queue === 'admin' ? 'admin' : undefined}
        isOpen={decisionItem !== null}
        onClose={() => setDecisionItem(null)}
        onSuccess={handleDecisionSuccess}
      />
    </>
  );
}

export function Approvals() {
  return <Navigate to="/leave?tab=approvals" replace />;
}
