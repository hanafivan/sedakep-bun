import { useCallback, useEffect, useState } from 'react';
import { Page } from '../components/Layout';
import { formatBytes, formatDate } from '../format';
import * as api from '../api';

/**
 * Backup & Restore (admin) — dua tab.
 *
 * Backup memakai `mysqldump` di server. Restore hanya boleh dari berkas yang
 * sudah ada di folder backup server, dan wajib dikonfirmasi dengan mengetik
 * "RESTORE" sebelum tombol aktif.
 */

type Tab = 'backup' | 'restore';

export function AdminBackup() {
  const [tab, setTab] = useState<Tab>('backup');
  const [files, setFiles] = useState<api.BackupFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await api.listBackups());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat daftar backup');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runBackup = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.createBackup();
      setNotice(`Backup dibuat: ${result.filename} (${formatBytes(result.size_bytes)}).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup gagal');
    } finally {
      setBusy(false);
    }
  };

  const runRestore = async () => {
    if (confirmText !== 'RESTORE') return;
    if (!window.confirm('Restore akan menimpa data saat ini. Lanjutkan?')) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.restoreBackup(selected);
      setNotice(`Restore dari ${selected} dijalankan.`);
      setConfirmText('');
      setSelected('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore gagal');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Backup & Restore" sub="Cadangkan dan pulihkan database aplikasi">
      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="tabs">
        <button
          type="button"
          className={tab === 'backup' ? 'tab active' : 'tab'}
          onClick={() => {
            setTab('backup');
            setError(null);
            setNotice(null);
          }}
        >
          Backup Database
        </button>
        <button
          type="button"
          className={tab === 'restore' ? 'tab active' : 'tab'}
          onClick={() => {
            setTab('restore');
            setError(null);
            setNotice(null);
          }}
        >
          Restore Database
        </button>
      </div>

      {tab === 'backup' ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Backup database</h2>
            <button className="button" type="button" disabled={busy} onClick={() => void runBackup()}>
              {busy ? 'Membuat...' : 'Buat backup sekarang'}
            </button>
          </div>
          <p className="sub">
            Membuat dump database ke folder <code>backups/</code> di server. Objek dokumen
            (MinIO) dicadangkan terpisah lewat <code>mc mirror</code>.
          </p>

          {loading ? <p className="sub">Memuat...</p> : null}
          {!loading && files.length === 0 ? <p className="sub">Belum ada berkas backup.</p> : null}

          {files.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Berkas</th>
                  <th>Ukuran</th>
                  <th>Dibuat</th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.filename}>
                    <td className="mono">{file.filename}</td>
                    <td>{formatBytes(file.size_bytes)}</td>
                    <td>{formatDate(file.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      ) : (
        <div className="panel">
          <div className="panel-head">
            <h2>Restore database</h2>
          </div>
          <p className="err" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            Peringatan: restore menimpa seluruh data saat ini dengan isi berkas backup.
          </p>

          <label htmlFor="restore-file">Berkas backup</label>
          <select
            id="restore-file"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            <option value="">— pilih berkas —</option>
            {files.map((file) => (
              <option key={file.filename} value={file.filename}>
                {file.filename}
              </option>
            ))}
          </select>

          <label htmlFor="restore-confirm">Ketik &quot;RESTORE&quot; untuk mengaktifkan tombol</label>
          <input
            id="restore-confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder="RESTORE"
            autoComplete="off"
          />

          <div className="actions">
            <button
              type="button"
              className="button danger"
              disabled={busy || !selected || confirmText !== 'RESTORE'}
              onClick={() => void runRestore()}
            >
              {busy ? 'Memproses...' : 'Jalankan restore'}
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}
