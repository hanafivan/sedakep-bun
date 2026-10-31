import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import {
  decisionLabel,
  formatBytes,
  formatDate,
  leaveStatusLabel,
  leaveStatusTone,
} from '../format';
import { useAuth } from '../auth';
import * as api from '../api';

/** Detail alibi: data, berkas, timeline approval 3 tingkat, dan keputusan. */

const canDecide = (role: string | undefined) =>
  role === 'admin' || role === 'verifikator' || role === 'atasan';

/** Unggah berkas: admin atau atasan (guard backend `requireRole('atasan')`). */
const canUpload = (role: string | undefined) => role === 'admin' || role === 'atasan';

export function AlibiDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const alibiId = Number(id);
  const fileInput = useRef<HTMLInputElement>(null);

  const [alibi, setAlibi] = useState<api.AlibiDetail | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setAlibi(await api.getAlibiRequest(alibiId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat alibi');
    }
  }, [alibiId]);

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
      setNote('');
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

  if (!alibi) {
    return (
      <Page title={`Alibi #${alibiId}`}>
        {error ? <p className="err">{error}</p> : <p className="sub">Memuat...</p>}
      </Page>
    );
  }

  const isAdmin = user?.role === 'admin';
  const isOwner = Number(user?.id) === Number(alibi.user_id);
  const editable =
    (isAdmin || isOwner) && alibi.status !== 'approved' && alibi.status !== 'cancelled';
  const final =
    alibi.admin_decision === 'accepted' &&
    alibi.approver_1_status === 'accepted' &&
    alibi.approver_2_status === 'accepted';

  return (
    <Page title={`Alibi #${alibi.id}`} sub={`${alibi.name} · ${alibi.nip ?? '-'}`}>
      <div className="toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate('/alibi')}>
          Kembali
        </button>
        {final ? (
          <button
            className="button secondary small"
            type="button"
            onClick={() => navigate(`/alibi/${alibi.id}/print`)}
          >
            Cetak
          </button>
        ) : null}
        {editable ? (
          <>
            <button className="button secondary small" type="button" onClick={() => navigate(`/alibi/${alibi.id}/edit`)}>
              Ubah
            </button>
            <button
              className="button danger small"
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Batalkan alibi ini?')) return;
                void run(() => api.cancelAlibi(alibi.id), 'Alibi dibatalkan.');
              }}
            >
              Batalkan
            </button>
            <button
              className="button danger small"
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm('Hapus alibi ini?')) return;
                void run(async () => {
                  await api.deleteAlibiRequest(alibi.id);
                  navigate('/alibi');
                }, 'Dihapus');
              }}
            >
              Hapus
            </button>
          </>
        ) : null}
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="split">
        <div className="panel">
          <div className="panel-head">
            <h2>Data alibi</h2>
            <span className={leaveStatusTone(alibi.status)}>{leaveStatusLabel(alibi.status)}</span>
          </div>

          <dl className="kv">
            <dt>Jenis</dt>
            <dd>{alibi.alibi_type ?? '-'}</dd>
            <dt>Tanggal</dt>
            <dd>{formatDate(alibi.alibi_date)}</dd>
            <dt>Jumlah hari</dt>
            <dd>{alibi.day_count ?? '-'}</dd>
            <dt>Jam</dt>
            <dd>
              {alibi.time_start ?? '-'}
              {alibi.time_end ? `–${alibi.time_end}` : ''}
            </dd>
            <dt>Alasan</dt>
            <dd>{alibi.reason ?? '-'}</dd>
            <dt>Atasan 1</dt>
            <dd>{alibi.approver_1_name ?? '-'}</dd>
            <dt>Atasan 2</dt>
            <dd>{alibi.approver_2_name ?? '-'}</dd>
            {alibi.verdict_note ? (
              <>
                <dt>Catatan</dt>
                <dd>{alibi.verdict_note}</dd>
              </>
            ) : null}
          </dl>

          <h3>Berkas</h3>
          {alibi.documents.length === 0 ? <p className="sub">Belum ada berkas.</p> : null}
          {alibi.documents.length > 0 ? (
            <ul className="docs">
              {alibi.documents.map((doc) => (
                <li key={doc.id}>
                  <span>{doc.original_filename}</span>
                  <span className="sub">{formatBytes(doc.size_bytes)}</span>
                  <button className="button secondary small" type="button" onClick={() => void download(doc.id)}>
                    Unduh
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {canUpload(user?.role) ? (
            <>
              <div className="actions">
                <button
                  className="button secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  Unggah berkas
                </button>
              </div>
              <input
                ref={fileInput}
                type="file"
                style={{ display: 'none' }}
                accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void run(() => api.uploadAlibiFile(alibi.id, file), 'Berkas tersimpan.');
                  event.target.value = '';
                }}
              />
            </>
          ) : null}
        </div>

        <div className="panel">
          <h2>Persetujuan</h2>
          <ol className="timeline">
            <li className={alibi.admin_decision === 'pending' ? 'current' : ''}>
              <strong>Admin</strong>
              <span>{decisionLabel(String(alibi.admin_decision))}</span>
            </li>
            <li
              className={
                alibi.admin_decision !== 'pending' && alibi.approver_1_status === 'pending'
                  ? 'current'
                  : ''
              }
            >
              <strong>Atasan 1</strong>
              <span>{decisionLabel(String(alibi.approver_1_status))}</span>
            </li>
            <li
              className={
                alibi.approver_1_status === 'accepted' && alibi.approver_2_status === 'pending'
                  ? 'current'
                  : ''
              }
            >
              <strong>Atasan 2</strong>
              <span>{decisionLabel(String(alibi.approver_2_status))}</span>
            </li>
          </ol>

          {canDecide(user?.role) && !final && alibi.status !== 'cancelled' ? (
            <>
              <label htmlFor="note">Catatan</label>
              <textarea
                id="note"
                rows={3}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />

              {isAdmin ? (
                <div className="actions">
                  <button
                    className="button"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.decideAlibiAdmin(alibi.id, 'accepted', note || undefined), 'Admin terima.')}
                  >
                    Admin: terima
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.decideAlibiAdmin(alibi.id, 'rejected', note || undefined), 'Admin tolak.')}
                  >
                    Admin: tolak
                  </button>
                </div>
              ) : null}

              {user?.role === 'atasan' || isAdmin ? (
                <div className="actions">
                  <button
                    className="button"
                    type="button"
                    disabled={busy || alibi.approver_1_status !== 'pending'}
                    onClick={() => void run(() => api.decideAlibiApprover(alibi.id, 1, 'accepted', note || undefined), 'Atasan 1 terima.')}
                  >
                    Atasan 1: terima
                  </button>
                  <button
                    className="button"
                    type="button"
                    disabled={busy || alibi.approver_1_status !== 'accepted' || alibi.approver_2_status !== 'pending'}
                    onClick={() => void run(() => api.decideAlibiApprover(alibi.id, 2, 'accepted', note || undefined), 'Atasan 2 terima.')}
                  >
                    Atasan 2: terima
                  </button>
                  <button
                    className="button danger"
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => api.decideAlibiApprover(alibi.id, alibi.approver_1_status === 'pending' ? 1 : 2, 'rejected', note || undefined), 'Ditolak.')}
                  >
                    Tolak (atasan)
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </Page>
  );
}
