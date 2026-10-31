import { useCallback, useEffect, useState } from 'react';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Master data: unit kerja (organisasi) dan jabatan. */

export function MasterData() {
  const [orgs, setOrgs] = useState<api.Organization[]>([]);
  const [positions, setPositions] = useState<api.Position[]>([]);
  const [orgForm, setOrgForm] = useState({ code: '', name: '', level: '3' });
  const [posForm, setPosForm] = useState({ name: '', grade: '' });
  const [editOrg, setEditOrg] = useState<api.Organization | null>(null);
  const [editPos, setEditPos] = useState<api.Position | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [o, p] = await Promise.all([api.listOrganizations(), api.listPositions()]);
      setOrgs(o);
      setPositions(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat master data');
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
    <Page title="Master Data" sub="Unit kerja dan jabatan">
      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="panel">
        <h2>Unit kerja / organisasi ({orgs.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Kode</th>
              <th>Nama</th>
              <th>Level</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {orgs.map((org) => (
              <tr key={org.id}>
                <td>{org.code}</td>
                <td>{editOrg?.id === org.id ? (
                  <input value={editOrg.name} onChange={(e) => setEditOrg({ ...editOrg, name: e.target.value })} />
                ) : (
                  org.name
                )}</td>
                <td>{org.level}</td>
                <td>
                  <span className={org.is_active ? 'badge ok' : 'badge muted'}>
                    {org.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>
                  {editOrg?.id === org.id ? (
                    <>
                      <button
                        className="button secondary small"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api.updateOrganization(org.id, { name: editOrg.name });
                            setEditOrg(null);
                          }, 'Organisasi diperbarui.')
                        }
                      >
                        Simpan
                      </button>{' '}
                      <button className="button secondary small" type="button" onClick={() => setEditOrg(null)}>
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="button secondary small" type="button" onClick={() => setEditOrg(org)}>
                        Ubah
                      </button>{' '}
                      <button
                        className="button secondary small"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => api.updateOrganization(org.id, { is_active: !org.is_active }),
                            'Status diperbarui.',
                          )
                        }
                      >
                        {org.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>{' '}
                      <button
                        className="button danger small"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Hapus unit ${org.name}?`)) return;
                          void run(() => api.deleteOrganization(org.id), 'Unit dihapus.');
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

        <h3>Tambah unit kerja</h3>
        <div className="grid2">
          <input
            placeholder="Kode (unik)"
            value={orgForm.code}
            onChange={(e) => setOrgForm({ ...orgForm, code: e.target.value })}
          />
          <input
            placeholder="Nama unit"
            value={orgForm.name}
            onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
          />
          <input
            placeholder="Level"
            type="number"
            value={orgForm.level}
            onChange={(e) => setOrgForm({ ...orgForm, level: e.target.value })}
          />
        </div>
        <div className="actions">
          <button
            className="button"
            type="button"
            disabled={busy || !orgForm.code.trim() || !orgForm.name.trim()}
            onClick={() =>
              void run(async () => {
                await api.createOrganization({
                  code: orgForm.code.trim(),
                  name: orgForm.name.trim(),
                  level: Number(orgForm.level) || 1,
                });
                setOrgForm({ code: '', name: '', level: '3' });
              }, 'Unit ditambahkan.')
            }
          >
            Tambah unit
          </button>
        </div>
      </div>

      <div className="panel">
        <h2>Jabatan ({positions.length})</h2>
        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Golongan</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos.id}>
                <td>
                  {editPos?.id === pos.id ? (
                    <input value={editPos.name} onChange={(e) => setEditPos({ ...editPos, name: e.target.value })} />
                  ) : (
                    pos.name
                  )}
                </td>
                <td>{pos.grade ?? '-'}</td>
                <td>
                  <span className={pos.is_active ? 'badge ok' : 'badge muted'}>
                    {pos.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </td>
                <td>
                  {editPos?.id === pos.id ? (
                    <>
                      <button
                        className="button secondary small"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api.updatePosition(pos.id, { name: editPos.name });
                            setEditPos(null);
                          }, 'Jabatan diperbarui.')
                        }
                      >
                        Simpan
                      </button>{' '}
                      <button className="button secondary small" type="button" onClick={() => setEditPos(null)}>
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="button secondary small" type="button" onClick={() => setEditPos(pos)}>
                        Ubah
                      </button>{' '}
                      <button
                        className="button secondary small"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => api.updatePosition(pos.id, { is_active: !pos.is_active }),
                            'Status diperbarui.',
                          )
                        }
                      >
                        {pos.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>{' '}
                      <button
                        className="button danger small"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Hapus jabatan ${pos.name}?`)) return;
                          void run(() => api.deletePosition(pos.id), 'Jabatan dihapus.');
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

        <h3>Tambah jabatan</h3>
        <div className="grid2">
          <input
            placeholder="Nama jabatan (unik)"
            value={posForm.name}
            onChange={(e) => setPosForm({ ...posForm, name: e.target.value })}
          />
          <input
            placeholder="Golongan"
            value={posForm.grade}
            onChange={(e) => setPosForm({ ...posForm, grade: e.target.value })}
          />
        </div>
        <div className="actions">
          <button
            className="button"
            type="button"
            disabled={busy || !posForm.name.trim()}
            onClick={() =>
              void run(async () => {
                await api.createPosition({
                  name: posForm.name.trim(),
                  grade: posForm.grade || undefined,
                });
                setPosForm({ name: '', grade: '' });
              }, 'Jabatan ditambahkan.')
            }
          >
            Tambah jabatan
          </button>
        </div>
      </div>
    </Page>
  );
}
