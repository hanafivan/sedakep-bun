import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { formatBytes, formatDate } from '../format';
import * as api from '../api';

/** Detail surat masuk: data, disposisi pelaksana, final, referensi, dan berkas. */

const STATUS_LABEL: Record<string, string> = {
  baru: 'Baru',
  didisposisi: 'Didisposisi',
  selesai: 'Selesai',
  arsip: 'Arsip',
  pending: 'Menunggu',
  accepted: 'Diterima',
  done: 'Selesai',
  rejected: 'Ditolak',
};

const DISPO_STATUS = ['pending', 'accepted', 'done', 'rejected'] as const;

export function IncomingLetterDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const letterId = Number(id);

  const [letter, setLetter] = useState<api.IncomingLetterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [dispo, setDispo] = useState({ target_name: '', target_nip: '', instruction: '' });
  const [finalRow, setFinalRow] = useState({ name: '', instruction: '' });
  const [reference, setReference] = useState('');

  const load = useCallback(async () => {
    try {
      setLetter(await api.getIncomingLetter(letterId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat surat masuk');
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
      setError(err instanceof Error ? err.message : 'Gagal membuka dokumen');
    }
  };

  if (!letter) {
    return (
      <Page title={`Surat Masuk #${letterId}`}>
        {error ? <p className="err">{error}</p> : <p className="sub">Memuat...</p>}
      </Page>
    );
  }

  return (
    <Page title={`Surat Masuk #${letter.id}`} sub={letter.letter_number ?? 'tanpa nomor'}>
      <div className="toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate('/incoming-letters')}>
          Kembali
        </button>
        <button className="button secondary small" type="button" onClick={() => navigate(`/incoming-letters/${letter.id}/print`)}>
          Cetak disposisi
        </button>
        <button className="button secondary small" type="button" onClick={() => navigate(`/incoming-letters/${letter.id}/edit`)}>
          Ubah
        </button>
        {letter.status !== 'selesai' ? (
          <button
            className="button small"
            type="button"
            disabled={busy}
            onClick={() => void run(() => api.finalizeIncomingLetter(letter.id), 'Surat difinalisasi.')}
          >
            Finalisasi
          </button>
        ) : null}
        <button
          className="button danger small"
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm('Hapus surat masuk ini?')) return;
            void run(async () => {
              await api.deleteIncomingLetter(letter.id);
              navigate('/incoming-letters');
            }, 'Dihapus');
          }}
        >
          Hapus
        </button>
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="panel">
        <div className="panel-head">
          <h2>Data surat</h2>
          <span className={letter.status === 'selesai' ? 'badge ok' : 'badge warn'}>
            {STATUS_LABEL[letter.status] ?? letter.status}
          </span>
        </div>
        <dl className="kv">
          <dt>Agenda</dt>
          <dd>{letter.agenda_number ?? '-'}</dd>
          <dt>Nomor surat</dt>
          <dd>{letter.letter_number ?? '-'}</dd>
          <dt>Asal</dt>
          <dd>{letter.origin ?? '-'}</dd>
          <dt>Tanggal surat</dt>
          <dd>{formatDate(letter.letter_date)}</dd>
          <dt>Diterima</dt>
          <dd>{formatDate(letter.received_date)}</dd>
          <dt>Klasifikasi</dt>
          <dd>{letter.classification_code ?? '-'}</dd>
          <dt>Isi</dt>
          <dd>{letter.content ?? '-'}</dd>
          <dt>Keterangan</dt>
          <dd>{letter.notes ?? '-'}</dd>
        </dl>
      </div>

      <div className="split">
        <div className="panel">
          <h2>Disposisi ({letter.dispositions.length})</h2>
          <table>
            <thead>
              <tr>
                <th>Tujuan</th>
                <th>Instruksi</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {letter.dispositions.map((row) => (
                <tr key={row.id}>
                  <td>{row.target_name ?? '-'}</td>
                  <td>{row.instruction ?? '-'}</td>
                  <td>
                    <span className="badge">{STATUS_LABEL[row.status] ?? row.status}</span>
                  </td>
                  <td>
                    <select
                      value={row.status}
                      disabled={busy}
                      onChange={(event) =>
                        void run(
                          () =>
                            api.updateDisposition(letter.id, row.id, {
                              status: event.target.value as (typeof DISPO_STATUS)[number],
                            }),
                          'Status disposisi diperbarui.',
                        )
                      }
                    >
                      {DISPO_STATUS.map((status) => (
                        <option key={status} value={status}>
                          {STATUS_LABEL[status]}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button danger small"
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => api.deleteDisposition(letter.id, row.id), 'Disposisi dihapus.')}
                    >
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Tambah disposisi</h3>
          <div className="grid2">
            <input
              placeholder="Nama tujuan"
              value={dispo.target_name}
              onChange={(event) => setDispo({ ...dispo, target_name: event.target.value })}
            />
            <input
              placeholder="NIP tujuan"
              value={dispo.target_nip}
              onChange={(event) => setDispo({ ...dispo, target_nip: event.target.value })}
            />
          </div>
          <input
            placeholder="Instruksi"
            value={dispo.instruction}
            onChange={(event) => setDispo({ ...dispo, instruction: event.target.value })}
          />
          <div className="actions">
            <button
              className="button secondary"
              type="button"
              disabled={busy || !dispo.target_name.trim()}
              onClick={() =>
                void run(async () => {
                  await api.addDisposition(letter.id, {
                    target_name: dispo.target_name.trim(),
                    target_nip: dispo.target_nip || undefined,
                    instruction: dispo.instruction || undefined,
                  });
                  setDispo({ target_name: '', target_nip: '', instruction: '' });
                }, 'Disposisi ditambahkan.')
              }
            >
              Tambah disposisi
            </button>
          </div>
        </div>

        <div>
          <div className="panel">
            <h2>Final ({letter.finals.length})</h2>
            <ul className="docs">
              {letter.finals.map((row) => (
                <li key={row.id}>
                  <span>
                    {row.name ?? '-'} — {row.instruction ?? '-'}
                  </span>
                  <button
                    className="button danger small"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.deleteDispositionFinal(letter.id, row.id), 'Final dihapus.')}
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
            <div className="actions">
              <input
                placeholder="Nama"
                value={finalRow.name}
                onChange={(event) => setFinalRow({ ...finalRow, name: event.target.value })}
              />
              <input
                placeholder="Instruksi"
                value={finalRow.instruction}
                onChange={(event) => setFinalRow({ ...finalRow, instruction: event.target.value })}
              />
              <button
                className="button secondary"
                type="button"
                disabled={busy || !finalRow.name.trim()}
                onClick={() =>
                  void run(async () => {
                    await api.addDispositionFinal(letter.id, {
                      name: finalRow.name.trim(),
                      instruction: finalRow.instruction || undefined,
                    });
                    setFinalRow({ name: '', instruction: '' });
                  }, 'Final ditambahkan.')
                }
              >
                Tambah
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>Referensi ({letter.references.length})</h2>
            <ul className="docs">
              {letter.references.map((row) => (
                <li key={row.id}>
                  <span>{row.reference_text ?? '-'}</span>
                  <button
                    className="button danger small"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.deleteIncomingLetterReference(letter.id, row.id), 'Referensi dihapus.')}
                  >
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
            <div className="actions">
              <input
                placeholder="Teks referensi"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
              />
              <button
                className="button secondary"
                type="button"
                disabled={busy || !reference.trim()}
                onClick={() =>
                  void run(async () => {
                    await api.addIncomingLetterReference(letter.id, reference.trim());
                    setReference('');
                  }, 'Referensi ditambahkan.')
                }
              >
                Tambah
              </button>
            </div>
          </div>

          <div className="panel">
            <h2>Berkas</h2>
            {letter.documents.length === 0 ? <p className="sub">Belum ada berkas.</p> : null}
            <ul className="docs">
              {letter.documents.map((doc) => (
                <li key={doc.id}>
                  <span>{doc.original_filename}</span>
                  <span className="sub">{formatBytes(doc.size_bytes)}</span>
                  <button className="button secondary small" type="button" onClick={() => void download(doc.id)}>
                    Unduh
                  </button>
                </li>
              ))}
            </ul>
            <div className="actions">
              <label className="sub" style={{ marginRight: 8 }}>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void run(() => api.uploadIncomingLetterFile(letter.id, file, 'sm'), 'Berkas tersimpan.');
                    event.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
