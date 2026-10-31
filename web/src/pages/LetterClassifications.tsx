import { useCallback, useEffect, useState } from 'react';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Kelola klasifikasi surat (kode, nama, uraian, aktif). */

export function LetterClassifications() {
  const [items, setItems] = useState<api.LetterClassification[]>([]);
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api.listClassifications());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat klasifikasi');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      await load();
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operasi gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Klasifikasi Surat" sub="Kode dan nama klasifikasi surat masuk">
      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th>Uraian</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.description ?? '-'}</td>
                <td>
                  <span className={item.is_active ? 'badge ok' : 'badge muted'}>
                    {item.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>
                  <button
                    className="button secondary small"
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => api.updateClassification(item.id, { is_active: !item.is_active }),
                        'Status klasifikasi diperbarui.',
                      )
                    }
                  >
                    {item.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                  </button>{' '}
                  <button
                    className="button danger small"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm(`Hapus klasifikasi ${item.code}?`)) return;
                      void run(() => api.deleteClassification(item.id), 'Klasifikasi dihapus.');
                    }}
                  >
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="sub">Belum ada klasifikasi.</p> : null}
      </div>

      <div className="panel">
        <h2>Tambah klasifikasi</h2>
        <div className="grid2">
          <input placeholder="Kode" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          <input placeholder="Nama" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <label>Uraian</label>
        <textarea
          rows={2}
          value={form.description}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <div className="actions">
          <button
            className="button"
            type="button"
            disabled={busy || !form.code.trim() || !form.name.trim()}
            onClick={() =>
              void run(async () => {
                await api.createClassification({
                  code: form.code.trim(),
                  name: form.name.trim(),
                  description: form.description || undefined,
                });
                setForm({ code: '', name: '', description: '' });
              }, 'Klasifikasi ditambahkan.')
            }
          >
            Tambah
          </button>
        </div>
      </div>
    </Page>
  );
}
