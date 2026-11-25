import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { decisionLabel, formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import { useAuth } from '../auth';
import * as api from '../api';

/** Detail surat tugas: header, anggota/keterangan/tembusan, berkas, dan panel admin. */

export function AssignmentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const letterId = Number(id);

  const [letter, setLetter] = useState<api.AssignmentLetterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [member, setMember] = useState({ name: '', nip: '', grade: '', position: '', organization_name: '' });
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);
  const [empSearch, setEmpSearch] = useState('');
  const [empResults, setEmpResults] = useState<api.AssignmentEmployee[]>([]);
  const [searchingEmp, setSearchingEmp] = useState(false);
  const [note, setNote] = useState('');
  const [copyTo, setCopyTo] = useState('');
  const [numberInput, setNumberInput] = useState('');
  const [decisionNote, setDecisionNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const detail = await api.getAssignmentLetter(letterId);
      setLetter(detail);
      setNumberInput(detail.letter_number ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat surat tugas');
    } finally {
      setLoading(false);
    }
  }, [letterId]);

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

  const download = async (documentId: number) => {
    try {
      const { url } = await api.getDownloadUrl(documentId);
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat tautan unduhan');
    }
  };

  const handleSearchEmp = async (query: string) => {
    setEmpSearch(query);
    if (!query.trim()) {
      setEmpResults([]);
      return;
    }
    setSearchingEmp(true);
    try {
      const results = await api.searchAssignmentEmployees(query.trim());
      setEmpResults(results);
    } catch {
      setEmpResults([]);
    } finally {
      setSearchingEmp(false);
    }
  };

  const handleSelectEmp = (emp: api.AssignmentEmployee) => {
    setMember({
      name: emp.name,
      nip: emp.nip ?? '',
      grade: emp.grade ?? '',
      position: emp.position ?? '',
      organization_name: emp.organization_name ?? '',
    });
    setEmpSearch('');
    setEmpResults([]);
  };

  if (loading) {
    return (
      <Page title="Surat Tugas">
        <p className="sub">Memuat...</p>
      </Page>
    );
  }

  if (!letter) {
    return (
      <Page title="Surat Tugas">
        <p className="err">{error ?? 'Surat tugas tidak ditemukan'}</p>
      </Page>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isOwner = Number(user?.id) === Number(letter.user_id);
  const canEdit = (isAdmin || isOwner) && letter.status !== 'approved' && letter.status !== 'cancelled';
  const isFinal = letter.decision === 'accepted';

  return (
    <Page
      title={letter.number_display ?? `Surat Tugas #${letter.id}`}
      sub={`${letter.name} · ${letter.nip ?? '-'}`}
    >
      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <h2>Header</h2>
            <div>
              <span className={leaveStatusTone(letter.status)}>{leaveStatusLabel(letter.status)}</span>{' '}
              <span className="badge">{decisionLabel(letter.decision)}</span>
            </div>
          </div>

          <dl className="kv">
            <dt>Kode</dt>
            <dd>{letter.code ?? '-'}</dd>
            <dt>Nomor</dt>
            <dd>{letter.number_display ?? 'Belum bernomor'}</dd>
            <dt>Tanggal</dt>
            <dd>
              {formatDate(letter.start_date)} — {formatDate(letter.end_date)}
            </dd>
            <dt>Hari / jam</dt>
            <dd>
              {letter.day_start ?? '-'}
              {letter.time_start ? ` ${letter.time_start}` : ''}
              {letter.time_end ? `–${letter.time_end}` : ''}
            </dd>
            <dt>Tempat</dt>
            <dd>{letter.place ?? '-'}</dd>
            <dt>Penanda tangan</dt>
            <dd>
              {letter.signer_name ?? '-'} {letter.signer_position ? `(${letter.signer_position})` : ''}
            </dd>
            <dt>Pertimbangan</dt>
            <dd>{letter.consideration ?? '-'}</dd>
            <dt>Dasar</dt>
            <dd>{letter.legal_basis ?? '-'}</dd>
            <dt>Isi tugas</dt>
            <dd>{letter.content ?? '-'}</dd>
            {letter.decision_note ? (
              <>
                <dt>Catatan keputusan</dt>
                <dd>{letter.decision_note}</dd>
              </>
            ) : null}
          </dl>

          <div className="actions">
            <button
              className="button secondary small"
              type="button"
              onClick={() => navigate(`/assignments/${letter.id}/print`)}
            >
              {isFinal ? 'Cetak' : 'Cetak (Draf)'}
            </button>
            {isFinal && isAdmin ? (
              <button
                className="button small"
                type="button"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const pdf = await api.generateAssignmentPdf(letter.id);
                    window.open(pdf.url, '_blank', 'noopener');
                  }, 'PDF dibuat.')
                }
              >
                Cetak PDF
              </button>
            ) : null}
            {canEdit ? (
              <>
                <button
                  className="button secondary small"
                  type="button"
                  onClick={() => navigate(`/assignments/${letter.id}/edit`)}
                >
                  Ubah
                </button>
                <button
                  className="button danger small"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('Batalkan surat tugas ini?')) return;
                    void run(
                      () => api.cancelAssignmentLetter(letter.id),
                      'Surat tugas dibatalkan.',
                    );
                  }}
                >
                  Batalkan
                </button>
                <button
                  className="button danger small"
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm('Hapus surat tugas ini?')) return;
                    void run(async () => {
                      await api.deleteAssignmentLetter(letter.id);
                      navigate('/assignments');
                    }, 'Dihapus');
                  }}
                >
                  Hapus
                </button>
              </>
            ) : null}
          </div>

          <h3>Berkas surat</h3>
          {letter.documents.length === 0 ? <p className="sub">Belum ada berkas.</p> : null}
          {letter.documents.length > 0 ? (
            <ul className="docs">
              {letter.documents.map((doc) => (
                <li key={doc.id}>
                  <span>{doc.original_filename}</span>
                  <button
                    className="button secondary small"
                    type="button"
                    onClick={() => void download(doc.id)}
                  >
                    Unduh
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          {isAdmin ? (
            <div className="panel">
              <h2>Panel admin</h2>
              {letter.status !== 'cancelled' ? (
                <>
                  <label>Catatan keputusan</label>
                  <input
                    value={decisionNote}
                    onChange={(event) => setDecisionNote(event.target.value)}
                  />
                  <div className="actions">
                    <button
                      className="button"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => api.decideAssignmentLetter(letter.id, 'accepted', decisionNote || undefined),
                          'Surat disetujui.',
                        )
                      }
                    >
                      Setujui
                    </button>
                    <button
                      className="button danger"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => api.decideAssignmentLetter(letter.id, 'rejected', decisionNote || undefined),
                          'Surat ditolak.',
                        )
                      }
                    >
                      Tolak
                    </button>
                  </div>
                </>
              ) : (
                <p className="sub">Surat dibatalkan.</p>
              )}

              <h3>Nomor surat</h3>
              {isFinal ? (
                <>
                  <input
                    value={numberInput}
                    onChange={(event) => setNumberInput(event.target.value)}
                    placeholder="mis. 123"
                  />
                  <div className="actions">
                    <button
                      className="button secondary"
                      type="button"
                      disabled={busy || !numberInput.trim()}
                      onClick={() =>
                        void run(
                          () => api.setAssignmentNumber(letter.id, numberInput.trim()),
                          'Nomor surat tersimpan.',
                        )
                      }
                    >
                      Simpan nomor
                    </button>
                  </div>
                </>
              ) : (
                <p className="sub">Nomor hanya dapat diisi setelah surat disetujui.</p>
              )}

              <h3>Berkas bertanda tangan</h3>
              {isFinal ? (
                <div>
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      void run(() => api.uploadAssignmentFile(letter.id, file), 'Berkas tersimpan.');
                    }}
                  />
                </div>
              ) : (
                <p className="sub">Unggah berkas hanya setelah surat disetujui.</p>
              )}
            </div>
          ) : null}

          <div className="panel">
            <h2>Anggota ({letter.members.length})</h2>
            <table>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>NIP</th>
                  <th>Jabatan</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {letter.members.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      {item.grade ? <div className="sub">{item.grade}</div> : null}
                    </td>
                    <td>{item.nip ?? '-'}</td>
                    <td>
                      <div>{item.position ?? '-'}</div>
                      {item.organization_name ? <div className="sub">{item.organization_name}</div> : null}
                    </td>
                    <td>
                      {canEdit ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="button secondary small"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setEditingMemberId(item.id);
                              setMember({
                                name: item.name,
                                nip: item.nip ?? '',
                                grade: item.grade ?? '',
                                position: item.position ?? '',
                                organization_name: item.organization_name ?? '',
                              });
                            }}
                          >
                            Ubah
                          </button>
                          <button
                            className="button danger small"
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void run(
                                () => api.deleteAssignmentMember(letter.id, item.id),
                                'Anggota dihapus.',
                              )
                            }
                          >
                            Hapus
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {canEdit ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <h3 style={{ margin: 0 }}>{editingMemberId ? 'Ubah anggota' : 'Tambah anggota'}</h3>
                  {!editingMemberId ? (
                    <button
                      className="button secondary small"
                      type="button"
                      onClick={() =>
                        setMember({
                          name: 'terlampir',
                          nip: '',
                          grade: '',
                          position: 'Daftar nama terlampir',
                          organization_name: '',
                        })
                      }
                    >
                      + Kolektif (Terlampir)
                    </button>
                  ) : null}
                </div>

                <div style={{ margin: '8px 0 12px', position: 'relative' }}>
                  <input
                    placeholder="🔍 Cari Pegawai internal (ketik nama atau NIP untuk autofill)..."
                    value={empSearch}
                    onChange={(event) => void handleSearchEmp(event.target.value)}
                  />
                  {searchingEmp ? <small style={{ color: 'var(--color-text-subtle, #64748b)' }}>Mencari pegawai...</small> : null}
                  {empResults.length > 0 ? (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 20,
                        backgroundColor: '#fff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                      }}
                    >
                      {empResults.map((emp) => (
                        <div
                          key={emp.id}
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderBottom: '1px solid #f1f5f9',
                          }}
                          onMouseDown={() => handleSelectEmp(emp)}
                        >
                          <strong>{emp.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {emp.nip ? `NIP. ${emp.nip}` : ''} {emp.position ? `· ${emp.position}` : ''} {emp.organization_name ? `· ${emp.organization_name}` : ''}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid2">
                  <input
                    placeholder="Nama"
                    value={member.name}
                    onChange={(event) => setMember({ ...member, name: event.target.value })}
                  />
                  <input
                    placeholder="NIP"
                    value={member.nip}
                    onChange={(event) => setMember({ ...member, nip: event.target.value })}
                  />
                  <input
                    placeholder="Golongan / Pangkat"
                    value={member.grade}
                    onChange={(event) => setMember({ ...member, grade: event.target.value })}
                  />
                  <input
                    placeholder="Jabatan"
                    value={member.position}
                    onChange={(event) => setMember({ ...member, position: event.target.value })}
                  />
                  <input
                    placeholder="Unit Kerja / Instansi"
                    value={member.organization_name}
                    onChange={(event) => setMember({ ...member, organization_name: event.target.value })}
                  />
                </div>
                <div className="actions">
                  <button
                    className="button"
                    type="button"
                    disabled={busy || !member.name.trim()}
                    onClick={() =>
                      void run(async () => {
                        if (editingMemberId) {
                          await api.updateAssignmentMember(letter.id, editingMemberId, {
                            name: member.name.trim(),
                            nip: member.nip || undefined,
                            grade: member.grade || undefined,
                            position: member.position || undefined,
                            organization_name: member.organization_name || undefined,
                          });
                          setEditingMemberId(null);
                        } else {
                          await api.addAssignmentMember(letter.id, {
                            name: member.name.trim(),
                            nip: member.nip || undefined,
                            grade: member.grade || undefined,
                            position: member.position || undefined,
                            organization_name: member.organization_name || undefined,
                          });
                        }
                        setMember({ name: '', nip: '', grade: '', position: '', organization_name: '' });
                      }, editingMemberId ? 'Anggota diperbarui.' : 'Anggota ditambahkan.')
                    }
                  >
                    {editingMemberId ? 'Simpan perubahan' : 'Tambah anggota'}
                  </button>
                  {editingMemberId ? (
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => {
                        setEditingMemberId(null);
                        setMember({ name: '', nip: '', grade: '', position: '', organization_name: '' });
                      }}
                    >
                      Batal ubah
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>

          <div className="panel">
            <h2>Keterangan ({letter.notes.length})</h2>
            <ul className="docs">
              {letter.notes.map((item) => (
                <li key={item.id}>
                  <span>{item.note}</span>
                  {canEdit ? (
                    <button
                      className="button danger small"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => api.deleteAssignmentNote(letter.id, item.id),
                          'Keterangan dihapus.',
                        )
                      }
                    >
                      Hapus
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className="actions">
                <input
                  placeholder="Keterangan baru"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || !note.trim()}
                  onClick={() =>
                    void run(async () => {
                      await api.addAssignmentNote(letter.id, note.trim());
                      setNote('');
                    }, 'Keterangan ditambahkan.')
                  }
                >
                  Tambah
                </button>
              </div>
            ) : null}
          </div>

          <div className="panel">
            <h2>Tembusan ({letter.copies.length})</h2>
            <ul className="docs">
              {letter.copies.map((item) => (
                <li key={item.id}>
                  <span>{item.copy_to}</span>
                  {canEdit ? (
                    <button
                      className="button danger small"
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => api.deleteAssignmentCopy(letter.id, item.id),
                          'Tembusan dihapus.',
                        )
                      }
                    >
                      Hapus
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            {canEdit ? (
              <div className="actions">
                <input
                  placeholder="Tembusan baru"
                  value={copyTo}
                  onChange={(event) => setCopyTo(event.target.value)}
                />
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || !copyTo.trim()}
                  onClick={() =>
                    void run(async () => {
                      await api.addAssignmentCopy(letter.id, copyTo.trim());
                      setCopyTo('');
                    }, 'Tembusan ditambahkan.')
                  }
                >
                  Tambah
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Page>
  );
}
