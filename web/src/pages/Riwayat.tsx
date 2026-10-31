import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Layout';
import { formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import * as api from '../api';

/**
 * Riwayat Pengajuan — satu daftar status untuk semua pengajuan milik pengguna
 * (cuti, layanan kepegawaian, surat tugas, alibi). Menggabungkan data dari
 * endpoint yang sudah ada; tidak ada perhitungan status di klien.
 */

type Row = {
  key: string;
  kind: string;
  title: string;
  date: string | null;
  status: string;
  to: string;
};

const TYPE_LABEL: Record<string, string> = {
  bpjs: 'BPJS',
};

export function Riwayat() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [leave, services, assignments, alibi, meta] = await Promise.all([
          api.listLeaveRequests({ page: 1 }).catch(() => null),
          api.listServiceRequests({ page: 1 }).catch(() => null),
          api.listAssignmentLetters({ page: 1 }).catch(() => null),
          api.listAlibiRequests({ page: 1 }).catch(() => null),
          api.getServiceMeta().catch(() => null),
        ]);
        if (!alive) return;

        const serviceLabel = (type: string) =>
          meta?.types.find((item) => item.type === type)?.label ?? TYPE_LABEL[type] ?? type;

        const collected: Row[] = [
          ...(leave?.items ?? []).map((item) => ({
            key: `leave-${item.id}`,
            kind: 'Cuti',
            title: item.leave_type,
            date: item.start_date,
            status: item.status,
            to: `/leave/${item.id}`,
          })),
          ...(services?.items ?? []).map((item) => ({
            key: `service-${item.id}`,
            kind: 'Layanan',
            title: serviceLabel(item.service_type),
            date: item.created_at,
            status: item.status,
            to: `/services/${item.id}`,
          })),
          ...(assignments?.items ?? []).map((item) => ({
            key: `assignment-${item.id}`,
            kind: 'Surat Tugas',
            title: item.number_display ?? item.content ?? 'Surat tugas',
            date: item.created_at,
            status: item.status,
            to: `/assignments/${item.id}`,
          })),
          ...(alibi?.items ?? []).map((item) => ({
            key: `alibi-${item.id}`,
            kind: 'Alibi',
            title: item.alibi_type ?? 'Alibi',
            date: item.alibi_date,
            status: item.status,
            to: `/alibi/${item.id}`,
          })),
        ];

        collected.sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')));
        setRows(collected);
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat riwayat');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Page
      title="Riwayat Pengajuan"
      sub="Status semua pengajuan Anda — cuti, layanan kepegawaian, surat tugas, dan alibi"
    >
      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="sub">Memuat riwayat...</p> : null}

      {!loading && rows.length === 0 ? (
        <div className="empty-state">
          <p>Belum ada pengajuan. Mulai dari mengajukan cuti atau layanan kepegawaian.</p>
          <Link className="button" to="/leave/new">
            Ajukan Cuti
          </Link>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Jenis</th>
                <th>Keterangan</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key}>
                  <td>{row.kind}</td>
                  <td>
                    <Link to={row.to}><strong>{row.title}</strong></Link>
                  </td>
                  <td>{formatDate(row.date)}</td>
                  <td>
                    <span className={leaveStatusTone(row.status)}>
                      {leaveStatusLabel(row.status)}
                    </span>
                  </td>
                  <td>
                    <Link className="button secondary small" to={row.to}>
                      Buka
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Page>
  );
}
