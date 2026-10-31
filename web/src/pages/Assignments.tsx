import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import * as api from '../api';

/** Daftar surat tugas: cari nama/NIP/nomor/kode, filter status dan tahun. */

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Semua status' },
  { value: 'submitted', label: 'Diajukan' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
];

export function Assignments() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{
    items: api.AssignmentLetter[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const page = Number(params.get('page') ?? 1);
  const search = params.get('search') ?? '';
  const status = params.get('status') ?? '';
  const year = params.get('year') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.listAssignmentLetters({
        page,
        search: search || undefined,
        status: status || undefined,
        year: year ? Number(year) : undefined,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat surat tugas');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, year]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.set('page', '1');
    setParams(next);
  };

  return (
    <Page title="Surat Tugas" sub="Daftar, pencarian, dan pengajuan surat tugas">
      <div className="toolbar">
        <input
          placeholder="Cari nama, NIP, nomor, atau kode"
          defaultValue={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') update('search', (event.target as HTMLInputElement).value);
          }}
        />
        <select value={status} onChange={(event) => update('status', event.target.value)}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          className="year"
          type="number"
          placeholder="Tahun"
          defaultValue={year}
          onBlur={(event) => update('year', event.target.value)}
        />
        <Link className="button" to="/assignments/new">
          Buat surat tugas
        </Link>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && data && data.items.length === 0 ? (
        <div className="empty-state">
          <p>Tidak ada surat tugas pada filter ini.</p>
          <Link className="button" to="/assignments/new">
            Buat Surat Tugas Baru
          </Link>
        </div>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Nama Pegawai</th>
                  <th>Kode</th>
                  <th>Mulai</th>
                  <th>Selesai</th>
                  <th>Tempat</th>
                  <th>Status</th>
                  <th>Keputusan</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link to={`/assignments/${item.id}`}><span className="mono">{item.number_display ?? item.id}</span></Link>
                    </td>
                    <td>
                      <strong>{item.name}</strong>
                      <div className="sub mono">{item.nip ?? '-'}</div>
                    </td>
                    <td><span className="mono">{item.code ?? '-'}</span></td>
                    <td>{formatDate(item.start_date)}</td>
                    <td>{formatDate(item.end_date)}</td>
                    <td>{item.place ?? '-'}</td>
                    <td>
                      <span className={leaveStatusTone(item.status)}>
                        {leaveStatusLabel(item.status)}
                      </span>
                    </td>
                    <td>
                      <span className={leaveStatusTone(item.decision)}>
                        {leaveStatusLabel(item.decision)}
                      </span>
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
              onClick={() => update('page', String(page - 1))}
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
              onClick={() => update('page', String(page + 1))}
            >
              Berikutnya →
            </button>
          </div>
        </>
      ) : null}
    </Page>
  );
}
