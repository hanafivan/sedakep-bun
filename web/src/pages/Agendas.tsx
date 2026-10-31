import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Daftar agenda: pencarian, filter tahun/bulan. */

const formatDateTime = (value: string | null): string => {
  if (!value) return '-';
  const iso = value.replace(' ', 'T');
  const [date, time] = iso.split('T');
  const [y, m, d] = (date ?? '').split('-');
  return `${d ?? ''}/${m ?? ''}/${y ?? ''} ${(time ?? '').slice(0, 5)}`;
};

export function Agendas() {
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<{
    items: api.Agenda[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const page = Number(params.get('page') ?? 1);
  const search = params.get('search') ?? '';
  const year = params.get('year') ?? '';
  const month = params.get('month') ?? '';

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await api.listAgendas({
          page,
          search: search || undefined,
          year: year ? Number(year) : undefined,
          month: month ? Number(month) : undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat agenda');
    } finally {
      setLoading(false);
    }
  }, [page, search, year, month]);

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
    <Page title="Agenda" sub="Daftar kegiatan dan laporannya">
      <div className="toolbar">
        <input
          placeholder="Cari judul, tempat, atau nama"
          defaultValue={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') update('search', (event.target as HTMLInputElement).value);
          }}
        />
        <input
          className="year"
          type="number"
          placeholder="Tahun"
          defaultValue={year}
          onBlur={(event) => update('year', event.target.value)}
        />
        <select value={month} onChange={(event) => update('month', event.target.value)}>
          <option value="">Semua bulan</option>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <Link className="button" to="/agenda/new">
          Tambah agenda
        </Link>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && data && data.items.length === 0 ? (
        <p className="sub">Tidak ada agenda pada filter ini.</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Judul</th>
                <th>Tempat</th>
                <th>Nama</th>
                <th>Laporan</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.start_at)}</td>
                  <td>
                    <Link to={`/agenda/${item.id}`}>{item.title}</Link>
                  </td>
                  <td>{item.place ?? '-'}</td>
                  <td>{item.name ?? '-'}</td>
                  <td>
                    {item.report ? <span className="badge ok">Ada</span> : <span className="badge muted">Belum</span>}
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
