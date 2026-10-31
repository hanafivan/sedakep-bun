import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import * as api from '../api';
import { IconCheckSquare } from '../components/Icons';

/**
 * Menu Persetujuan Cuti:
 *
 * Menampilkan antrean permohonan yang masih menunggu keputusan berjenjang
 * (admin, atasan 1, atasan 2) serta permohonan yang sudah disetujui (cuti jadi).
 */

type ApprovalTab = 'pending' | 'approved' | 'all';

const TABS: Array<{ key: ApprovalTab; label: string; status?: string }> = [
  { key: 'pending', label: 'Menunggu persetujuan', status: 'submitted,in_review' },
  { key: 'approved', label: 'Sudah disetujui', status: 'approved' },
  { key: 'all', label: 'Semua permohonan' },
];

export function ApprovalsPanel({
  onTotalPendingChange,
}: {
  onTotalPendingChange?: (count: number) => void;
}) {
  const navigate = useNavigate();
  const perPage = 25;
  const [tab, setTab] = useState<ApprovalTab>('pending');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [items, setItems] = useState<api.LeaveRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeTabConfig = TABS.find((t) => t.key === tab);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.listLeaveRequests({
        status: activeTabConfig?.status,
        search: search || undefined,
        page,
        per_page: perPage,
      });
      setItems(list.items);
      setTotal(list.total);
      if (tab === 'pending') {
        onTotalPendingChange?.(list.total);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat permohonan');
    } finally {
      setLoading(false);
    }
  }, [activeTabConfig?.status, search, page, tab, onTotalPendingChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSearchSubmit = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  return (
    <>
      <div className="tabs" style={{ marginBottom: 16 }}>
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'tab active' : 'tab'}
            onClick={() => {
              setTab(item.key);
              setPage(1);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="toolbar">
        <input
          placeholder="Cari nama, NIP, atau ID permohonan..."
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') onSearchSubmit();
          }}
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
        <span className="sub" style={{ marginLeft: 'auto' }}>
          {total} permohonan
        </span>
      </div>

      {loading ? <p className="sub">Memuat data permohonan cuti...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon" aria-hidden="true">
            <IconCheckSquare size={28} />
          </div>
          <p>
            {tab === 'pending'
              ? 'Tidak ada permohonan cuti yang menunggu persetujuan saat ini.'
              : tab === 'approved'
              ? 'Belum ada permohonan cuti yang berstatus disetujui.'
              : 'Tidak ada data permohonan cuti yang cocok dengan filter.'}
          </p>
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
                  <th>Admin</th>
                  <th>Atasan 1</th>
                  <th>Atasan 2</th>
                  <th>Status Final</th>
                  <th>Nomor SK</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/leave/${item.id}`} className="mono">
                        #{item.id}
                      </Link>
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                      {item.nip ? <div className="sub">{item.nip}</div> : null}
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
                      <span className={leaveStatusTone(item.admin_decision)}>
                        {leaveStatusLabel(item.admin_decision)}
                      </span>
                    </td>
                    <td>
                      <span className={leaveStatusTone(item.approver_1_status)}>
                        {leaveStatusLabel(item.approver_1_status)}
                      </span>
                    </td>
                    <td>
                      <span className={leaveStatusTone(item.approver_2_status)}>
                        {leaveStatusLabel(item.approver_2_status)}
                      </span>
                    </td>
                    <td>
                      <span className={leaveStatusTone(item.status)}>
                        {leaveStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      {item.letter_number ? (
                        <span style={{ color: '#047857', fontWeight: 600 }}>{item.letter_number}</span>
                      ) : (
                        <span className="sub">-</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={item.status === 'submitted' || item.status === 'in_review' ? 'button small primary' : 'button small secondary'}
                        onClick={() => navigate(`/leave/${item.id}`)}
                      >
                        {item.status === 'submitted' || item.status === 'in_review' ? 'Periksa & Putuskan' : 'Detail'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <button
              className="button secondary small"
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Sebelumnya
            </button>
            <span className="pager-info">Halaman {page} dari {Math.ceil(total / perPage) || 1} ({total} permohonan)</span>
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
    </>
  );
}

export function Approvals() {
  return <Navigate to="/leave?tab=approvals" replace />;
}
