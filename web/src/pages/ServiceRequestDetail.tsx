import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { decisionLabel, formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import { useAuth } from '../auth';
import * as api from '../api';

/** Detail permohonan layanan: data, dokumen berlabel, verifikasi, surat, approval. */

export function ServiceRequestDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const requestId = Number(id);

  const [detail, setDetail] = useState<api.ServiceRequestDetail | null>(null);
  const [meta, setMeta] = useState<api.ServiceTypeMeta | null>(null);
  const [note, setNote] = useState('');
  const [check, setCheck] = useState({ check_type: '', result: 'ok', notes: '' });
  const [letter, setLetter] = useState({ letter_type: 'sphd', number: '' });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingLabel = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const value = await api.getServiceRequest(requestId);
      setDetail(value);
      const metaValue = await api.getServiceMeta();
      setMeta(metaValue.types.find((item) => item.type === value.service_type) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat permohonan');
    }
  }, [requestId]);

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

  if (!detail) {
    return (
      <Page title={`Layanan #${requestId}`}>
        {error ? <p className="err">{error}</p> : <p className="sub">Memuat...</p>}
      </Page>
    );
  }

  const isStaff = user?.role === 'admin' || user?.role === 'verifikator' || user?.role === 'atasan';
  const isOwner = Number(user?.id) === Number(detail.user_id);
  const editable = (isStaff || isOwner) && detail.status !== 'approved' && detail.status !== 'cancelled';
  const final = detail.status === 'approved' || detail.status === 'cancelled';

  const docByLabel = new Map(detail.service_documents.map((row) => [row.label, row.document_id]));
  const fileName = (documentId: number | null) =>
    detail.documents.find((doc) => doc.id === documentId)?.original_filename ?? null;

  return (
    <Page title={`Layanan #${detail.id}`} sub={`${meta?.label ?? detail.service_type} · ${detail.name}`}>
      <div className="toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate('/services')}>
          Kembali
        </button>
        {isStaff ? (
          <button
            className="button small"
            type="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const pdf = await api.generateServicePdf(detail.id);
                window.open(pdf.url, '_blank', 'noopener');
              }, 'PDF dibuat.')
            }
          >
            Cetak PDF
          </button>
        ) : null}
        {editable ? (
          <button className="button secondary small" type="button" onClick={() => navigate(`/services/${detail.id}/edit`)}>
            Ubah
          </button>
        ) : null}
        {editable ? (
          <button
            className="button danger small"
            type="button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Hapus permohonan ini?')) return;
              void run(async () => {
                await api.deleteServiceRequest(detail.id);
                navigate('/services');
              }, 'Dihapus');
            }}
          >
            Hapus
          </button>
        ) : null}
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="split">
        <div>
          <div className="panel">
            <div className="panel-head">
              <h2>Data permohonan</h2>
              <span className={leaveStatusTone(detail.status)}>{leaveStatusLabel(detail.status)}</span>
            </div>
            <dl className="kv">
              <dt>Jenis</dt>
              <dd>{meta?.label ?? detail.service_type}</dd>
              {detail.subtype ? (
                <>
                  <dt>{meta?.subtype_label ?? 'Subjenis'}</dt>
                  <dd>{detail.subtype}</dd>
                </>
              ) : null}
              <dt>Judul</dt>
              <dd>{detail.title ?? '-'}</dd>
              <dt>Nama</dt>
              <dd>{detail.name}</dd>
              <dt>NIP</dt>
              <dd>{detail.nip ?? '-'}</dd>
              <dt>Telepon</dt>
              <dd>{detail.phone ?? '-'}</dd>
              {meta?.fields.map((field) => (
                <span key={field.key} style={{ display: 'contents' }}>
                  <dt>{field.label}</dt>
                  <dd>{detail.fields[field.key] ?? '-'}</dd>
                </span>
              ))}
              {detail.decision_note ? (
                <>
                  <dt>Catatan</dt>
                  <dd>{detail.decision_note}</dd>
                </>
              ) : null}
            </dl>
          </div>

          <div className="panel">
            <h2>Dokumen</h2>
            <ul className="docs">
              {(meta?.documents ?? []).map((doc) => {
                const documentId = docByLabel.get(doc.label) ?? null;
                const name = fileName(documentId);
                return (
                  <li key={doc.label}>
                    <span>
                      {doc.title}
                      {name ? <div className="sub">{name}</div> : null}
                    </span>
                    {documentId ? (
                      <button className="button secondary small" type="button" onClick={() => void download(documentId)}>
                        Unduh
                      </button>
                    ) : (
                      <span className="sub">Belum ada</span>
                    )}
                    {editable ? (
                      <button
                        className="button secondary small"
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          pendingLabel.current = doc.label;
                          fileInput.current?.click();
                        }}
                      >
                        Unggah
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <input
              ref={fileInput}
              type="file"
              style={{ display: 'none' }}
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(event) => {
                const file = event.target.files?.[0];
                const label = pendingLabel.current;
                if (file && label) void run(() => api.uploadServiceDocument(detail.id, label, file), 'Dokumen tersimpan.');
                event.target.value = '';
                pendingLabel.current = null;
              }}
            />
          </div>
        </div>

        <div>
          <div className="panel">
            <h2>Persetujuan</h2>
            <ol className="timeline">
              <li className={detail.decision === 'pending' ? 'current' : ''}>
                <strong>Verifikator</strong>
                <span>{decisionLabel(String(detail.decision))}</span>
              </li>
            </ol>
            {isStaff && !final ? (
              <>
                <label htmlFor="note">Catatan</label>
                <textarea id="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
                <div className="actions">
                  <button className="button" type="button" disabled={busy} onClick={() => void run(() => api.approveServiceRequest(detail.id, 'accepted', note || undefined), 'Disetujui.')}>
                    Terima
                  </button>
                  <button className="button danger" type="button" disabled={busy} onClick={() => void run(() => api.approveServiceRequest(detail.id, 'rejected', note || undefined), 'Ditolak.')}>
                    Tolak
                  </button>
                </div>
              </>
            ) : null}
          </div>

          <div className="panel">
            <h2>Verifikasi berkas</h2>
            <ul className="docs">
              {detail.checks.map((row) => (
                <li key={row.id}>
                  <span>
                    {row.check_type}: {row.result ?? '-'}
                    {row.notes ? <div className="sub">{row.notes}</div> : null}
                  </span>
                </li>
              ))}
            </ul>
            {isStaff ? (
              <div className="actions">
                <input
                  placeholder="Jenis berkas"
                  value={check.check_type}
                  onChange={(event) => setCheck({ ...check, check_type: event.target.value })}
                />
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy || !check.check_type.trim()}
                  onClick={() =>
                    void run(async () => {
                      await api.addServiceCheck(detail.id, {
                        check_type: check.check_type.trim(),
                        result: check.result,
                        notes: check.notes || undefined,
                      });
                      setCheck({ check_type: '', result: 'ok', notes: '' });
                    }, 'Verifikasi tersimpan.')
                  }
                >
                  Tambah
                </button>
              </div>
            ) : null}
          </div>

          <div className="panel">
            <h2>Surat terbit</h2>
            <ul className="docs">
              {detail.letters.map((row) => (
                <li key={row.id}>
                  <span>
                    {row.letter_type.toUpperCase()} {row.number ? `— ${row.number}` : ''}
                    {row.issued_at ? <div className="sub">{formatDate(row.issued_at)}</div> : null}
                  </span>
                </li>
              ))}
            </ul>
            {isStaff && (meta?.letters.length ?? 0) > 0 ? (
              <div className="actions">
                <select value={letter.letter_type} onChange={(event) => setLetter({ ...letter, letter_type: event.target.value })}>
                  {meta?.letters.map((type) => (
                    <option key={type} value={type}>
                      {type.toUpperCase()}
                    </option>
                  ))}
                </select>
                <input placeholder="Nomor surat" value={letter.number} onChange={(event) => setLetter({ ...letter, number: event.target.value })} />
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api.addServiceLetter(detail.id, {
                        letter_type: letter.letter_type as 'sphd' | 'sppid' | 'sk' | 'suket',
                        number: letter.number || undefined,
                      });
                      setLetter({ letter_type: letter.letter_type, number: '' });
                    }, 'Surat dicatat.')
                  }
                >
                  Catat surat
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Page>
  );
}
