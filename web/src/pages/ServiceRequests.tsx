import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { leaveStatusLabel, leaveStatusTone } from '../format';
import * as api from '../api';

/** Daftar permohonan layanan kepegawaian (pensiun, gelar, pangkat, dll). */

export function ServiceRequests() {
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState<api.ServiceTypeMeta[]>([]);
  const [data, setData] = useState<{
    items: api.ServiceRequest[];
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
  const serviceType = params.get('service_type') ?? '';

  useEffect(() => {
    api.getServiceMeta().then((value) => setMeta(value.types)).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await api.listServiceRequests({
          page,
          search: search || undefined,
          status: status || undefined,
          service_type: serviceType || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat permohonan layanan');
    } finally {
      setLoading(false);
    }
  }, [page, search, status, serviceType]);

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

  const typeLabel = (type: string) => meta.find((item) => item.type === type)?.label ?? type;

  return (
    <Page title="Layanan Kepegawaian" sub="Pensiun, gelar, karpeg, karis/karsu, BPJS, taspen, pangkat, dan lainnya">
      <div className="toolbar">
        <input
          placeholder="Cari nama, NIP, atau judul"
          defaultValue={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') update('search', (event.target as HTMLInputElement).value);
          }}
        />
        <select value={serviceType} onChange={(event) => update('service_type', event.target.value)}>
          <option value="">Semua jenis</option>
          {meta.map((item) => (
            <option key={item.type} value={item.type}>
              {item.label}
            </option>
          ))}
        </select>
        <select value={status} onChange={(event) => update('status', event.target.value)}>
          <option value="">Semua status</option>
          <option value="submitted">Diajukan</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
        </select>
        <Link className="button" to="/services/new">
          Buat permohonan
        </Link>
      </div>

      {error ? <p className="err">{error}</p> : null}
      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && data && data.items.length === 0 ? (
        <p className="sub">Tidak ada permohonan pada filter ini.</p>
      ) : null}

      {data && data.items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Nomor</th>
                <th>Jenis</th>
                <th>Nama</th>
                <th>Judul</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <Link to={`/services/${item.id}`}>{item.id}</Link>
                  </td>
                  <td>{typeLabel(item.service_type)}</td>
                  <td>
                    {item.name}
                    <div className="sub">{item.nip ?? '-'}</div>
                  </td>
                  <td>{item.title ?? '-'}</td>
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
