import { useEffect, useState } from 'react';
import { Page } from '../components/Layout';
import { formatBytes } from '../format';
import * as api from '../api';

/** Laporan migrasi: dokumen yang sudah dipindah tapi modulnya belum diport. */

export function Migration() {
  const [unlinked, setUnlinked] = useState<api.DocumentItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    api
      .listUnlinkedDocuments()
      .then((rows) => {
        if (alive) setUnlinked(rows);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat dokumen');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const totalSize = unlinked.reduce((sum, item) => sum + (item.size_bytes ?? 0), 0);

  return (
    <Page title="Laporan Migrasi" sub="Dokumen yang sudah dipindah ke penyimpanan objek">
      {loading ? <p className="sub">Memuat...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="stats">
        <div className="stat">
          <div className="stat-label">Dokumen belum tertaut</div>
          <div className="stat-value">{unlinked.length}</div>
          <div className="stat-hint">milik modul yang belum diport</div>
        </div>
        <div className="stat">
          <div className="stat-label">Ukuran tampil</div>
          <div className="stat-value">{formatBytes(totalSize)}</div>
          <div className="stat-hint">halaman ini saja</div>
        </div>
      </div>

      {unlinked.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nama berkas</th>
              <th>Tipe</th>
              <th>Ukuran</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {unlinked.map((item) => (
              <tr key={item.id}>
                <td>{item.id}</td>
                <td>{item.original_filename}</td>
                <td>{item.mime_type ?? '-'}</td>
                <td>{formatBytes(item.size_bytes)}</td>
                <td>{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : !loading ? (
        <p className="sub">Semua dokumen sudah tertaut ke entitas.</p>
      ) : null}
    </Page>
  );
}
