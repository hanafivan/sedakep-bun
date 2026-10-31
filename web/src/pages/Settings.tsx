import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Layout';
import * as api from '../api';

/**
 * Pengaturan umum (admin): identitas instansi + tabel key/value `settings`.
 *
 * Semua nilai berasal dari API `/settings`; tidak ada yang dihitung di sini.
 * Baris `readonly` (mis. `scheduler.*`) hanya bisa dibaca.
 */

export function Settings() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Page title="Instansi" sub="Identitas instansi, master data, dan pengaturan umum">
      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="toolbar">
        <Link className="button secondary" to="/admin/master">
          Buka Master Data (unit kerja &amp; jabatan)
        </Link>
      </div>

      <InstancePanel onError={setError} onNotice={setNotice} />
      <SchedulerPanel onError={setError} />
      <GeneralPanel onError={setError} onNotice={setNotice} />
    </Page>
  );
}

type PanelProps = {
  onError: (message: string) => void;
  onNotice?: (message: string) => void;
};

/** Identitas instansi untuk kop surat. */
function InstancePanel({ onError, onNotice }: PanelProps) {
  const [form, setForm] = useState<api.InstanceProfile>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const profile = await api.getInstanceProfile();
        if (alive) setForm(profile);
      } catch (err) {
        if (alive) onError(err instanceof Error ? err.message : 'Gagal memuat identitas instansi');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [onError]);

  const save = async () => {
    setBusy(true);
    try {
      await api.updateInstanceProfile(form);
      onNotice?.('Identitas instansi tersimpan.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal menyimpan identitas instansi');
    } finally {
      setBusy(false);
    }
  };

  const fields: Array<{ key: keyof api.InstanceProfile; label: string }> = [
    { key: 'name', label: 'Nama instansi' },
    { key: 'address', label: 'Alamat' },
    { key: 'website', label: 'Website' },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status' },
    { key: 'head_name', label: 'Nama kepala' },
    { key: 'head_nip', label: 'NIP kepala' },
    { key: 'logo', label: 'Logo (URL)' },
  ];

  return (
    <div className="panel">
      <h2>Identitas instansi</h2>
      <p className="sub">Dipakai untuk kop surat dan tampilan.</p>
      {loading ? <p className="sub">Memuat...</p> : null}

      <div className="grid2">
        {fields.map((field) => (
          <div key={field.key}>
            <label>{field.label}</label>
            <input
              value={form[field.key] ?? ''}
              onChange={(event) =>
                setForm({ ...form, [field.key]: event.target.value } as api.InstanceProfile)
              }
            />
          </div>
        ))}
      </div>

      <div className="actions">
        <button className="button" type="button" disabled={busy || loading} onClick={() => void save()}>
          Simpan identitas
        </button>
      </div>
    </div>
  );
}

/** Status job scheduler (penanda `scheduler.*`) — hanya baca. */
function SchedulerPanel({ onError }: { onError: (message: string) => void }) {
  const [rows, setRows] = useState<api.SettingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const items = await api.listSettings({ prefix: 'scheduler.' });
        if (alive) setRows(items);
      } catch (err) {
        if (alive) onError(err instanceof Error ? err.message : 'Gagal memuat status scheduler');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [onError]);

  if (!loading && rows.length === 0) return null;

  return (
    <div className="panel">
      <h2>Status scheduler</h2>
      <p className="sub">Penanda job otomatis (rollover tahunan). Dikelola sistem.</p>
      {loading ? <p className="sub">Memuat...</p> : null}
      {rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Kunci</th>
              <th>Nilai</th>
              <th>Diperbarui</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>{row.value ?? '-'}</td>
                <td>{row.updated_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

/** Tabel key/value pengaturan umum. */
function GeneralPanel({ onError, onNotice }: PanelProps) {
  const [rows, setRows] = useState<api.SettingRow[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [edit, setEdit] = useState<{ key: string; value: string; description: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.listSettings(filter ? { search: filter } : undefined));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  }, [filter, onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    try {
      await action();
      await load();
      onNotice?.(message);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Operasi gagal');
    } finally {
      setBusy(false);
    }
  };

  const saveNew = () => {
    const key = newKey.trim();
    if (!key) return;
    void run(async () => {
      await api.setSetting(key, {
        value: newValue === '' ? null : newValue,
        description: newDescription === '' ? null : newDescription,
      });
      setNewKey('');
      setNewValue('');
      setNewDescription('');
    }, `Pengaturan "${key}" disimpan.`);
  };

  const saveEdit = () => {
    if (!edit) return;
    const target = edit;
    void run(async () => {
      await api.setSetting(target.key, {
        value: target.value === '' ? null : target.value,
        description: target.description === '' ? null : target.description,
      });
      setEdit(null);
    }, `Pengaturan "${target.key}" diperbarui.`);
  };

  return (
    <div className="panel">
      <h2>Pengaturan umum ({rows.length})</h2>
      <p className="sub">
        Kunci berawalan <code>scheduler.</code> dikelola sistem dan tidak bisa diubah di sini.
      </p>

      <div className="toolbar">
        <input
          placeholder="Cari kunci atau keterangan"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>

      {loading ? <p className="sub">Memuat...</p> : null}
      {!loading && rows.length === 0 ? <p className="sub">Tidak ada pengaturan.</p> : null}

      {rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Kunci</th>
              <th>Nilai</th>
              <th>Keterangan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>{row.key}</td>
                <td>
                  {edit?.key === row.key ? (
                    <input
                      value={edit.value}
                      placeholder={row.secret ? 'Nilai baru (kosong = hapus)' : ''}
                      onChange={(event) => setEdit({ ...edit, value: event.target.value })}
                    />
                  ) : (
                    row.value ?? '-'
                  )}
                </td>
                <td>
                  {edit?.key === row.key ? (
                    <input
                      value={edit.description}
                      onChange={(event) => setEdit({ ...edit, description: event.target.value })}
                    />
                  ) : (
                    row.description ?? '-'
                  )}
                </td>
                <td>
                  {row.readonly ? (
                    <span className="badge muted">sistem</span>
                  ) : edit?.key === row.key ? (
                    <>
                      <button className="button secondary small" type="button" disabled={busy} onClick={() => void saveEdit()}>
                        Simpan
                      </button>{' '}
                      <button className="button secondary small" type="button" onClick={() => setEdit(null)}>
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="button secondary small"
                        type="button"
                        onClick={() =>
                          setEdit({
                            key: row.key,
                            value: row.secret ? '' : row.value ?? '',
                            description: row.description ?? '',
                          })
                        }
                      >
                        Ubah
                      </button>{' '}
                      <button
                        className="button danger small"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Hapus pengaturan ${row.key}?`)) return;
                          void run(() => api.deleteSetting(row.key), `Pengaturan "${row.key}" dihapus.`);
                        }}
                      >
                        Hapus
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      <h3>Tambah / timpa pengaturan</h3>
      <div className="grid2">
        <input
          placeholder="Kunci (mis. app.title)"
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
        />
        <input
          placeholder="Nilai"
          value={newValue}
          onChange={(event) => setNewValue(event.target.value)}
        />
        <input
          placeholder="Keterangan (opsional)"
          value={newDescription}
          onChange={(event) => setNewDescription(event.target.value)}
        />
      </div>
      <div className="actions">
        <button className="button" type="button" disabled={busy || !newKey.trim()} onClick={saveNew}>
          Simpan pengaturan
        </button>
      </div>
    </div>
  );
}
