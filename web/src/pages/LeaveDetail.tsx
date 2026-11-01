import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Page, QuotaCard } from '../components/Layout';
import {
  decisionLabel,
  durationUnitLabel,
  formatBytes,
  formatDate,
  formatMasaKerja,
  leaveStatusLabel,
  leaveStatusTone,
} from '../format';
import { useAuth } from '../auth';
import * as api from '../api';
import { LeaveFormModal } from '../components/LeaveFormModal';
import { LeaveSkModal } from '../components/LeaveSkModal';

/** Detail permohonan: identitas, timeline approval, lampiran, dan surat keterangan. */

const canDecide = (role: string | undefined) =>
  role === 'admin' || role === 'verifikator' || role === 'atasan';

/** Admin/verifikator/atasan yang boleh menerbitkan surat. */
const canIssueLetter = (role: string | undefined) => canDecide(role);

type Detail = api.LeaveRequest & {
  letters?: api.LeaveLetter[];
  attachments?: api.DocumentItem[];
};

export function LeaveDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const requestId = Number(id);
  const letterFileInput = useRef<HTMLInputElement>(null);
  const [pendingLetterId, setPendingLetterId] = useState<number | null>(null);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [skModalOpen, setSkModalOpen] = useState(false);
  const [applicantQuota, setApplicantQuota] = useState<api.Quota | null>(null);
  const [quotaN, setQuotaN] = useState<number | ''>('');
  const [quotaN1, setQuotaN1] = useState<number | ''>('');
  const [quotaN2, setQuotaN2] = useState<number | ''>('');
  const [noteN, setNoteN] = useState('');
  const [noteN1, setNoteN1] = useState('');
  const [noteN2, setNoteN2] = useState('');
  const [note, setNote] = useState('');
  const [officialName, setOfficialName] = useState('');
  const [isEditingAdminQuota, setIsEditingAdminQuota] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const req = await api.getLeaveRequest(requestId);
      setDetail(req);
      const reqYear = req.start_date ? Number(req.start_date.slice(0, 4)) : undefined;
      if (req.user_id) {
        api.getQuotaFor(req.user_id, reqYear).then((q) => {
          setApplicantQuota(q);
          const raw = req as Record<string, unknown>;
          setQuotaN(raw.legacy_quota_n !== undefined && raw.legacy_quota_n !== null
            ? Number(raw.legacy_quota_n)
            : q.available.n);
          setQuotaN1(raw.legacy_quota_n1 !== undefined && raw.legacy_quota_n1 !== null
            ? Number(raw.legacy_quota_n1)
            : q.available.n1);
          setQuotaN2(raw.legacy_quota_n2 !== undefined && raw.legacy_quota_n2 !== null
            ? Number(raw.legacy_quota_n2)
            : q.available.n2);
          setNoteN((raw.legacy_note_n as string) ?? '');
          setNoteN1((raw.legacy_note_n1 as string) ?? '');
          setNoteN2((raw.legacy_note_n2 as string) ?? '');
        }).catch(() => null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat detail');
    }
  }, [requestId]);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (level: 'admin' | 1 | 2, decision: 'accepted' | 'rejected') => {
    setBusy(true);
    setError(null);
    try {
      if (level === 'admin') {
        await api.decideAdmin(requestId, decision, note || undefined, {
          quota_n: typeof quotaN === 'number' ? quotaN : undefined,
          quota_n1: typeof quotaN1 === 'number' ? quotaN1 : undefined,
          quota_n2: typeof quotaN2 === 'number' ? quotaN2 : undefined,
          note_n: noteN.trim() || undefined,
          note_n1: noteN1.trim() || undefined,
          note_n2: noteN2.trim() || undefined,
        });
      } else {
        await api.decideApprover(requestId, level, decision, note || undefined);
      }
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Keputusan gagal disimpan');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.cancelLeaveRequest(requestId, note || undefined);
      setNote('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pembatalan gagal');
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

  const issue = async (letterType: 'suket' | 'suket_madrasah') => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api.issueLetter(requestId, {
        letter_type: letterType,
        official_name: officialName || undefined,
      });
      setNotice(`Surat ${result.number} diterbitkan.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menerbitkan surat');
    } finally {
      setBusy(false);
    }
  };

  const uploadLetterFile = async (letterId: number, file: File) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api.uploadLetterFile(letterId, file);
      setNotice('Berkas SK tersimpan.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah berkas SK');
    } finally {
      setBusy(false);
      setPendingLetterId(null);
    }
  };

  const revoke = async (letterType: 'suket' | 'suket_madrasah') => {
    setBusy(true);
    setError(null);
    try {
      await api.revokeLetter(requestId, letterType);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencabut surat');
    } finally {
      setBusy(false);
    }
  };

  const final =
    detail?.admin_decision === 'accepted' && detail?.approver_2_status === 'accepted';
  const letters = detail?.letters ?? [];
  const attachments = detail?.attachments ?? [];

  return (
    <Page title={`Permohonan #${requestId}`} sub="Detail dan riwayat persetujuan">
      <div className="toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate('/leave')}>
          Kembali ke daftar
        </button>
        {detail?.status === 'pending' && user && detail.user_id === user.id ? (
          <Link className="button secondary small" to={`/leave/${requestId}/edit`}>
            Edit
          </Link>
        ) : null}
        <button
          type="button"
          className="button secondary small"
          onClick={() => setFormModalOpen(true)}
        >
          Cetak Form BKN
        </button>
        <button
          className="button secondary small"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const pdf = await api.generateLeaveFormPdf(requestId);
              window.open(pdf.url, '_blank', 'noopener');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Gagal membuat Formulir BKN');
            } finally {
              setBusy(false);
            }
          }}
        >
          Form BKN (PDF)
        </button>
        {letters.length > 0 ? (
          <button
            type="button"
            className="button secondary small"
            onClick={() => setSkModalOpen(true)}
          >
            Cetak SK
          </button>
        ) : null}
        {letters.length > 0 ? (
          <button
            className="button secondary small"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const pdf = await api.generateLeavePdf(requestId);
                window.open(pdf.url, '_blank', 'noopener');
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Gagal membuat SK PDF');
              } finally {
                setBusy(false);
              }
            }}
          >
            Cetak SK (PDF)
          </button>
        ) : null}
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}
      {!detail ? <p className="sub">Memuat...</p> : null}

      {detail ? (
        <div className="split">
          <div className="panel">
            <div className="panel-head">
              <h2>Data permohonan</h2>
              <span className={leaveStatusTone(String(detail.status))}>
                {leaveStatusLabel(String(detail.status))}
              </span>
            </div>

            <dl className="kv">
              <dt>Nama</dt>
              <dd>{detail.name}</dd>
              <dt>NIP</dt>
              <dd>{detail.nip ?? '-'}</dd>
              <dt>Jenis cuti</dt>
              <dd>{detail.leave_type}</dd>
              <dt>Periode</dt>
              <dd>
                {formatDate(detail.start_date)} - {formatDate(detail.end_date)}
              </dd>
              <dt>Lama</dt>
              <dd>
                {detail.duration} {durationUnitLabel(detail.duration_unit)}
              </dd>
              <dt>Alasan</dt>
              <dd>{detail.reason ?? '-'}</dd>
              {detail.rejection_reason ? (
                <>
                  <dt>Catatan</dt>
                  <dd>{detail.rejection_reason}</dd>
                </>
              ) : null}
            </dl>

            <h3>Lampiran</h3>
            {attachments.length === 0 ? (
              <p className="sub">Tidak ada lampiran.</p>
            ) : (
              <ul className="docs">
                {attachments.map((doc) => (
                  <li key={doc.id}>
                    <span>{doc.original_filename}</span>
                    <span className="sub">{formatBytes(doc.size_bytes)}</span>
                    <button
                      className="button secondary small"
                      type="button"
                      onClick={() => download(doc.id)}
                    >
                      Unduh
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <h3>Surat keterangan</h3>
            {letters.length === 0 ? (
              <p className="sub">Belum ada surat diterbitkan.</p>
            ) : (
              <ul className="docs">
                {letters.map((letter) => (
                  <li key={letter.id}>
                    <span>
                      <strong>{letter.number ?? '(tanpa nomor)'}</strong>{' '}
                      <span className="sub">
                        {letter.letter_type === 'suket' ? 'SK cuti' : 'SK madrasah'}
                        {letter.issued_at ? ` · ${formatDate(letter.issued_at)}` : ''}
                      </span>
                    </span>
                    {letter.document_id ? (
                      <button
                        className="button secondary small"
                        type="button"
                        onClick={() => download(letter.document_id as number)}
                      >
                        Berkas
                      </button>
                    ) : (
                      <span className="sub">Belum ada berkas</span>
                    )}
                    {canIssueLetter(user?.role) ? (
                      <>
                        <button
                          className="button secondary small"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setPendingLetterId(letter.id);
                            letterFileInput.current?.click();
                          }}
                        >
                          Unggah SK
                        </button>
                        <button
                          className="button danger small"
                          type="button"
                          disabled={busy}
                          onClick={() => revoke(letter.letter_type)}
                        >
                          Cabut
                        </button>
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {canIssueLetter(user?.role) && final ? (
              <>
                <label htmlFor="official_name">Nama penanda tangan (opsional)</label>
                <input
                  id="official_name"
                  value={officialName}
                  onChange={(event) => setOfficialName(event.target.value)}
                />
                <div className="actions">
                  <button type="button" className="button" disabled={busy} onClick={() => issue('suket')}>
                    Terbitkan SK cuti
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={busy}
                    onClick={() => issue('suket_madrasah')}
                  >
                    Terbitkan SK madrasah
                  </button>
                </div>
              </>
            ) : null}

            <input
              ref={letterFileInput}
              type="file"
              style={{ display: 'none' }}
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && pendingLetterId) void uploadLetterFile(pendingLetterId, file);
                event.target.value = '';
              }}
            />

            {applicantQuota ? (
              <div style={{ marginTop: '1.5rem' }}>
                <h3>Pemeriksaan Kuota Cuti Pemohon ({applicantQuota.year})</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '12px 0' }}>
                  <QuotaCard
                    label={`Tahun N (${applicantQuota.year})`}
                    value={applicantQuota.available.n}
                    hint={`Resmi: ${applicantQuota.official.n} hari`}
                    tone={applicantQuota.available.n > 0 ? 'ok' : 'warn'}
                  />
                  <QuotaCard
                    label={`Tahun N-1 (${applicantQuota.year - 1})`}
                    value={applicantQuota.available.n1}
                    hint={`Resmi: ${applicantQuota.official.n1} hari`}
                    tone={applicantQuota.available.n1 > 0 ? 'ok' : 'warn'}
                  />
                  <QuotaCard
                    label={`Tahun N-2 (${applicantQuota.year - 2})`}
                    value={applicantQuota.available.n2}
                    hint={`Resmi: ${applicantQuota.official.n2} hari`}
                    tone={applicantQuota.available.n2 > 0 ? 'ok' : 'warn'}
                  />
                </div>
                <div style={{ fontSize: '12.5px', color: '#475569', background: '#f8fafc', padding: '8px 12px', borderRadius: '6px' }}>
                  Total Kuota Tersedia: <strong>{applicantQuota.available.total} hari</strong> · Status: <span className={applicantQuota.eligibility.eligible ? 'badge ok' : 'badge warn'}>{applicantQuota.eligibility.eligible ? 'Eligible' : 'Belum Eligible'}</span> ({formatMasaKerja(applicantQuota.eligibility.months_worked)} masa kerja)
                </div>
              </div>
            ) : null}
          </div>

          <div className="panel">
            <h2>Persetujuan</h2>
            <ol className="timeline">
              <li className={detail.admin_decision === 'pending' ? 'current' : ''}>
                <strong>Admin Verifikasi</strong>
                <span>
                  <span className={leaveStatusTone(detail.admin_decision)}>
                    {decisionLabel(String(detail.admin_decision))}
                  </span>
                </span>
              </li>
              <li className={detail.admin_decision !== 'pending' && detail.approver_1_status === 'pending' ? 'current' : ''}>
                <strong>Atasan Langsung (Pertimbangan)</strong>
                <span>
                  <span className={leaveStatusTone(detail.approver_1_status)}>
                    {decisionLabel(String(detail.approver_1_status))}
                  </span>
                </span>
              </li>
              <li className={detail.approver_1_status === 'accepted' && detail.approver_2_status === 'pending' ? 'current' : ''}>
                <strong>Pejabat Berwenang Memberikan Cuti</strong>
                <span>
                  <span className={leaveStatusTone(detail.approver_2_status)}>
                    {decisionLabel(String(detail.approver_2_status))}
                  </span>
                </span>
              </li>
            </ol>

            {(detail as Record<string, unknown>).legacy_quota_n !== null && (detail as Record<string, unknown>).legacy_quota_n !== undefined ? (
              <div className="admin-acc-box">
                <div className="admin-acc-box-head">
                  <strong>Catatan Kuota Admin saat ACC:</strong>
                  {user?.role === 'admin' && !isEditingAdminQuota ? (
                    <button
                      type="button"
                      className="button small secondary"
                      onClick={() => setIsEditingAdminQuota(true)}
                    >
                      Ubah Kuota / ACC
                    </button>
                  ) : null}
                </div>
                <div>
                  N: {String((detail as Record<string, unknown>).legacy_quota_n)} hari {(detail as Record<string, unknown>).legacy_note_n ? `(${(detail as Record<string, unknown>).legacy_note_n})` : ''} · N-1: {String((detail as Record<string, unknown>).legacy_quota_n1)} hari {(detail as Record<string, unknown>).legacy_note_n1 ? `(${(detail as Record<string, unknown>).legacy_note_n1})` : ''} · N-2: {String((detail as Record<string, unknown>).legacy_quota_n2)} hari {(detail as Record<string, unknown>).legacy_note_n2 ? `(${(detail as Record<string, unknown>).legacy_note_n2})` : ''}
                </div>
              </div>
            ) : null}

            {((canDecide(user?.role) && !final) || (user?.role === 'admin' && isEditingAdminQuota)) && detail.status !== 'cancelled' ? (
              <>
                {user?.role === 'admin' ? (
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '14px', border: '1px solid #e2e8f0' }}>
                    <strong style={{ display: 'block', marginBottom: '8px', fontSize: '13px', color: '#334155' }}>
                      Konfirmasi Sisa Kuota Cuti (dicatat pada SK):
                    </strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Sisa N (Hari)</label>
                        <input
                          type="number"
                          value={quotaN}
                          onChange={(e) => setQuotaN(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <input
                          placeholder="Ket. N"
                          style={{ marginTop: '4px', fontSize: '12px' }}
                          value={noteN}
                          onChange={(e) => setNoteN(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Sisa N-1 (Hari)</label>
                        <input
                          type="number"
                          value={quotaN1}
                          onChange={(e) => setQuotaN1(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <input
                          placeholder="Ket. N-1"
                          style={{ marginTop: '4px', fontSize: '12px' }}
                          value={noteN1}
                          onChange={(e) => setNoteN1(e.target.value)}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>Sisa N-2 (Hari)</label>
                        <input
                          type="number"
                          value={quotaN2}
                          onChange={(e) => setQuotaN2(e.target.value === '' ? '' : Number(e.target.value))}
                        />
                        <input
                          placeholder="Ket. N-2"
                          style={{ marginTop: '4px', fontSize: '12px' }}
                          value={noteN2}
                          onChange={(e) => setNoteN2(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}

                <label htmlFor="note">Catatan</label>
                <textarea
                  id="note"
                  rows={3}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                />

                {user?.role === 'admin' ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="button"
                      disabled={busy}
                      onClick={() => {
                        void decide('admin', 'accepted').then(() => setIsEditingAdminQuota(false));
                      }}
                    >
                      {isEditingAdminQuota ? 'Simpan Perubahan ACC' : 'Admin: Setujui'}
                    </button>
                    <button
                      className="button danger"
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void decide('admin', 'rejected').then(() => setIsEditingAdminQuota(false));
                      }}
                    >
                      Admin: Tolak
                    </button>
                    {isEditingAdminQuota ? (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => setIsEditingAdminQuota(false)}
                      >
                        Batal Ubah
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {user?.role === 'atasan' || user?.role === 'admin' ? (
                  <div className="actions">
                    <button
                      type="button"
                      className="button"
                      disabled={busy || detail.approver_1_status !== 'pending'}
                      onClick={() => decide(1, 'accepted')}
                    >
                      Atasan 1: Setujui
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      disabled={busy || detail.approver_1_status !== 'pending'}
                      onClick={() => decide(1, 'rejected')}
                    >
                      Atasan 1: Tolak
                    </button>
                    <button
                      type="button"
                      className="button"
                      disabled={busy || detail.approver_2_status !== 'pending' || detail.approver_1_status !== 'accepted'}
                      onClick={() => decide(2, 'accepted')}
                    >
                      Atasan 2: Setujui
                    </button>
                    <button
                      type="button"
                      className="button danger"
                      disabled={busy || detail.approver_2_status !== 'pending' || detail.approver_1_status !== 'accepted'}
                      onClick={() => decide(2, 'rejected')}
                    >
                      Atasan 2: Tolak
                    </button>
                  </div>
                ) : null}

                <div className="actions">
                  <button
                    className="button secondary danger"
                    type="button"
                    disabled={busy}
                    onClick={cancel}
                  >
                    Batalkan permohonan
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <LeaveFormModal
        requestId={requestId}
        isOpen={formModalOpen}
        onClose={() => setFormModalOpen(false)}
      />

      <LeaveSkModal
        requestId={requestId}
        isOpen={skModalOpen}
        onClose={() => setSkModalOpen(false)}
      />
    </Page>
  );
}
