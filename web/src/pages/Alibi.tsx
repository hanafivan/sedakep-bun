import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import * as api from '../api';

/** Daftar alibi: cari nama/NIP/jenis, filter status dan tahun. */

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Semua status' },
  { value: 'submitted', label: 'Diajukan' },
  { value: 'in_review', label: 'Diproses' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
  { value: 'cancelled', label: 'Dibatalkan' },
];

export function Alibi() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{
    items: api.AlibiRequest[];
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
      setData(
        await api.listAlibiRequests({
          page,
          search: search || undefined,
          status: status || undefined,
          year: year ? Number(year) : undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat alibi');
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
    <Page title="Alibi" sub="Daftar, pencarian, dan pengajuan alibi">
      <div className="toolbar">
        <input
          placeholder="Cari nama, NIP, atau jenis"
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
        <Link className="button" to="/alibi/new">
          Ajukan alibi
        </Link>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && data && data.items.length === 0 ? (
        <p className="sub">Tidak ada alibi pada filter ini.</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Nomor</th>
                <th>Nama</th>
                <th>Jenis</th>
                <th>Tanggal</th>
                <th>Hari</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/alibi/${item.id}`}>{item.id}</Link>
                  </td>
                  <td>
                    {item.name}
                    <div className="sub">{item.nip ?? '-'}</div>
                  </td>
                  <td>{item.alibi_type ?? '-'}</td>
                  <td>{formatDate(item.alibi_date)}</td>
                  <td>{item.day_count ?? '-'}</td>
                  <td>
                    <span className={leaveStatusTone(item.status)}>
                      {leaveStatusLabel(item.status)}
                    </span>
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
