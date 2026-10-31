import { useEffect, useState } from 'react';
import { Page } from '../components/Layout';
import { useAuth } from '../auth';
import * as api from '../api';

/** Profil pengguna: ubah data diri dan ganti sandi. */

export function Profile() {
  const { user, refresh } = useAuth();
  const [form, setForm] = useState({ name: '', nip: '', grade: '', email: '', phone: '' });
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name ?? '',
        nip: user.nip ?? '',
        grade: user.grade ?? '',
        email: '',
        phone: '',
      });
    }
  }, [user]);

  const saveProfile = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.updateMe({
        name: form.name || undefined,
        nip: form.nip || undefined,
        grade: form.grade || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      await refresh();
      setNotice('Profil tersimpan.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profil');
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async () => {
    if (pwd.next.length < 6) {
      setError('Sandi baru minimal 6 karakter.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.changePassword(pwd.current, pwd.next);
      setPwd({ current: '', next: '' });
      setNotice('Sandi diganti.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengganti sandi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Profil" sub="Data akun dan kata sandi">
      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="split">
        <div className="panel">
          <h2>Data diri</h2>
          <dl className="kv">
            <dt>Username</dt>
            <dd>{user?.username ?? '-'}</dd>
            <dt>Peran</dt>
            <dd>{user?.role ?? '-'}</dd>
            <dt>Jenis pegawai</dt>
            <dd>{user?.employment_type ?? '-'}</dd>
          </dl>

          <div className="grid2">
            <div>
              <label>Nama</label>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div>
              <label>NIP</label>
              <input value={form.nip} onChange={(event) => setForm({ ...form, nip: event.target.value })} />
            </div>
            <div>
              <label>Golongan</label>
              <input value={form.grade} onChange={(event) => setForm({ ...form, grade: event.target.value })} />
            </div>
            <div>
              <label>Email</label>
              <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </div>
            <div>
              <label>Telepon</label>
              <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
          </div>
          <div className="actions">
            <button className="button" type="button" disabled={busy} onClick={() => void saveProfile()}>
              Simpan profil
            </button>
          </div>
        </div>

        <div className="panel">
          <h2>Ganti sandi</h2>
          <label>Sandi saat ini</label>
          <input
            type="password"
            value={pwd.current}
            onChange={(event) => setPwd({ ...pwd, current: event.target.value })}
          />
          <label>Sandi baru (min 6)</label>
          <input
            type="password"
            value={pwd.next}
            onChange={(event) => setPwd({ ...pwd, next: event.target.value })}
          />
          <div className="actions">
            <button
              className="button"
              type="button"
              disabled={busy || !pwd.current || pwd.next.length < 6}
              onClick={() => void savePassword()}
            >
              Ganti sandi
            </button>
          </div>
        </div>
      </div>
    </Page>
  );
}
