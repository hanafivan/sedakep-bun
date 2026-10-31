import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { formatDate } from '../format';
import * as api from '../api';

/** Daftar surat masuk: pencarian, filter status & tahun. */

const STATUS_LABEL: Record<string, string> = {
  baru: 'Baru',
  didisposisi: 'Didisposisi',
  selesai: 'Selesai',
  arsip: 'Arsip',
};

const STATUS_TONE: Record<string, string> = {
  baru: 'badge warn',
  didisposisi: 'badge',
  selesai: 'badge ok',
  arsip: 'badge muted',
};

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'baru', label: 'Baru' },
  { value: 'didisposisi', label: 'Didisposisi' },
  { value: 'selesai', label: 'Selesai' },
  { value: 'arsip', label: 'Arsip' },
];

export function IncomingLetters() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{
    items: api.IncomingLetter[];
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
        await api.listIncomingLetters({
          page,
          search: search || undefined,
          status: status || undefined,
          year: year ? Number(year) : undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat surat masuk');
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
    <Page title="Surat Masuk" sub="Disposisi surat masuk umum">
      <div className="toolbar">
        <input
          placeholder="Cari nomor, asal, agenda, atau nama"
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
        <Link className="button" to="/incoming-letters/new">
          Catat surat
        </Link>
        <Link className="button secondary" to="/letter-classifications">
          Klasifikasi
        </Link>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && data && data.items.length === 0 ? (
        <p className="sub">Tidak ada surat masuk pada filter ini.</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Agenda</th>
                <th>Nomor surat</th>
                <th>Asal</th>
                <th>Diterima</th>
                <th>Disposisi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/incoming-letters/${item.id}`}>{item.agenda_number ?? item.id}</Link>
                  </td>
                  <td>{item.letter_number ?? '-'}</td>
                  <td>{item.origin ?? '-'}</td>
                  <td>{formatDate(item.received_date)}</td>
                  <td>{item.disposition_count}</td>
                  <td>
                    <span className={STATUS_TONE[item.status] ?? 'badge'}>
                      {STATUS_LABEL[item.status] ?? item.status}
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
              Sebelumnya
            </button>
            <span>
              Halaman {data.page} dari {data.total_pages || 1} ({data.total} data)
            </span>
            <button
              className="button secondary small"
              type="button"
              disabled={page >= data.total_pages}
              onClick={() => update('page', String(page + 1))}
            >
              Berikutnya
            </button>
          </div>
        </>
      ) : null}
    </Page>
  );
}
