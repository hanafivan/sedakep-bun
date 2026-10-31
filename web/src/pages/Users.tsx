import { useCallback, useEffect, useState } from 'react';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Manajemen pengguna (admin): daftar, tambah, ubah peran/status, reset sandi. */

const ROLES = ['pegawai', 'verifikator', 'atasan', 'admin'] as const;

type EditState = {
  id: number;
  username: string;
  name: string;
  nip: string;
  grade: string;
  role: (typeof ROLES)[number];
  is_active: boolean;
};

export function Users() {
  const [data, setData] = useState<{
    items: api.User[];
    total: number;
    page: number;
    per_page: number;
    total_pages: number;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [create, setCreate] = useState({ username: '', password: '', name: '', nip: '', role: 'pegawai' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await api.listUsers({
          search: search || undefined,
          role: role || undefined,
          is_active: status || undefined,
          page,
          per_page: 25,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat pengguna');
    } finally {
      setLoading(false);
    }
  }, [search, role, status, page]);

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

  const startEdit = (user: api.User) => {
    setEdit({
      id: user.id,
      username: user.username,
      name: user.name,
      nip: user.nip ?? '',
      grade: user.grade ?? '',
      role: user.role,
      is_active: user.is_active,
    });
    setNotice(null);
    setError(null);
  };

  return (
    <Page title="Pengguna" sub="Kelola akun, peran, dan status kepegawaian">
      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="toolbar">
        <input
          placeholder="Cari nama / NIP / username"
          defaultValue={search}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              setPage(1);
              setSearch((event.target as HTMLInputElement).value);
            }
          }}
        />
        <select
          value={role}
          onChange={(event) => {
            setPage(1);
            setRole(event.target.value);
          }}
        >
          <option value="">Semua peran</option>
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => {
            setPage(1);
            setStatus(event.target.value);
          }}
        >
          <option value="">Semua status</option>
          <option value="true">Aktif</option>
          <option value="false">Nonaktif</option>
        </select>
      </div>

      {loading ? <p className="sub">Memuat...</p> : null}

      {data && data.items.length > 0 ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Nama</th>
                <th>NIP</th>
                <th>Peran</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id}>
                  <td>{user.username}</td>
                  <td>{user.name}</td>
                  <td>{user.nip ?? '-'}</td>
                  <td>
                    <span className="badge">{user.role}</span>
                  </td>
                  <td>
                    <span className={user.is_active ? 'badge ok' : 'badge muted'}>
                      {user.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <button className="button secondary small" type="button" onClick={() => startEdit(user)}>
                      Ubah
                    </button>{' '}
                    <button
                      className="button danger small"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const next = window.prompt(`Sandi baru untuk ${user.username} (min 6):`);
                        if (!next) return;
                        void run(() => api.resetUserPassword(user.id, next), 'Sandi direset.');
                      }}
                    >
                      Reset sandi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="pager">
            <button className="button secondary small" type="button" disabled={page <= 1} onClick={() => setPage((v) => v - 1)}>
              Sebelumnya
            </button>
            <span>
              Halaman {data.page} dari {data.total_pages || 1} ({data.total} data)
            </span>
            <button
              className="button secondary small"
              type="button"
              disabled={page >= data.total_pages}
              onClick={() => setPage((v) => v + 1)}
            >
              Berikutnya
            </button>
          </div>
        </>
      ) : null}
      {!loading && data && data.items.length === 0 ? <p className="sub">Tidak ada pengguna.</p> : null}

      {edit ? (
        <div className="panel">
          <div className="panel-head">
            <h2>Ubah {edit.username}</h2>
            <button className="button secondary small" type="button" onClick={() => setEdit(null)}>
              Tutup
            </button>
          </div>
          <div className="grid2">
            <div>
              <label>Nama</label>
              <input value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} />
            </div>
            <div>
              <label>NIP</label>
              <input value={edit.nip} onChange={(event) => setEdit({ ...edit, nip: event.target.value })} />
            </div>
            <div>
              <label>Golongan</label>
              <input value={edit.grade} onChange={(event) => setEdit({ ...edit, grade: event.target.value })} />
            </div>
            <div>
              <label>Peran</label>
              <select
                value={edit.role}
                onChange={(event) => setEdit({ ...edit, role: event.target.value as EditState['role'] })}
              >
                {ROLES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select
                value={edit.is_active ? 'true' : 'false'}
                onChange={(event) => setEdit({ ...edit, is_active: event.target.value === 'true' })}
              >
                <option value="true">Aktif</option>
                <option value="false">Nonaktif</option>
              </select>
            </div>
          </div>
          <div className="actions">
            <button
              className="button"
              type="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await api.updateUser(edit.id, {
                    name: edit.name || undefined,
                    nip: edit.nip || undefined,
                    grade: edit.grade || undefined,
                    role: edit.role,
                    is_active: edit.is_active,
                  });
                  setEdit(null);
                }, 'Pengguna diperbarui.')
              }
            >
              Simpan
            </button>
          </div>
        </div>
      ) : null}

      <div className="panel">
        <h2>Tambah pengguna</h2>
        <div className="grid2">
          <div>
            <label>Username</label>
            <input value={create.username} onChange={(event) => setCreate({ ...create, username: event.target.value })} />
          </div>
          <div>
            <label>Sandi (min 6)</label>
            <input
              type="password"
              value={create.password}
              onChange={(event) => setCreate({ ...create, password: event.target.value })}
            />
          </div>
          <div>
            <label>Nama</label>
            <input value={create.name} onChange={(event) => setCreate({ ...create, name: event.target.value })} />
          </div>
          <div>
            <label>NIP</label>
            <input value={create.nip} onChange={(event) => setCreate({ ...create, nip: event.target.value })} />
          </div>
          <div>
            <label>Peran</label>
            <select value={create.role} onChange={(event) => setCreate({ ...create, role: event.target.value })}>
              {ROLES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="actions">
          <button
            className="button"
            type="button"
            disabled={busy || create.username.length < 3 || create.password.length < 6}
            onClick={() =>
              void run(async () => {
                await api.registerUser({
                  username: create.username.trim(),
                  password: create.password,
                  name: create.name || undefined,
                  nip: create.nip || undefined,
                });
                // Peran diatur setelah registrasi (register selalu role default).
                if (create.role !== 'pegawai') {
                  const list = await api.listUsers({ search: create.username.trim(), per_page: 1 });
                  const created = list.items.find((u) => u.username === create.username.trim());
                  if (created) await api.updateUser(created.id, { role: create.role as EditState['role'] });
                }
                setCreate({ username: '', password: '', name: '', nip: '', role: 'pegawai' });
              }, 'Pengguna ditambahkan.')
            }
          >
            Tambah pengguna
          </button>
        </div>
      </div>
    </Page>
  );
}
