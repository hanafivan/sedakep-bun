import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api';
import { useAuth } from '../auth';
import { formatDate, leaveStatusLabel, leaveStatusTone } from '../format';
import { Modal } from './Modal';
import { IconCheck, IconExternalLink, IconX } from './Icons';

export interface LeaveDecisionModalProps {
  request: api.LeaveRequest | null;
  defaultLevel?: 1 | 2 | 'admin';
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function LeaveDecisionModal({
  request,
  defaultLevel,
  isOpen,
  onClose,
  onSuccess,
}: LeaveDecisionModalProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.username === 'admin' || user?.username === 'superadmin';

  // Tentukan level keputusan yang relevan
  const resolveInitialLevel = (): 1 | 2 | 'admin' => {
    if (defaultLevel) return defaultLevel;
    if (!request) return 1;

    // Jika atasan 1 belum memutuskan dan user adalah atasan 1 (atau admin)
    if (request.approver_1_status === 'pending') {
      if (isAdmin || (user?.nip && user.nip === request.approver_1_nip)) {
        return 1;
      }
    }
    // Jika atasan 1 sudah accepted dan atasan 2 pending
    if (request.approver_1_status === 'accepted' && request.approver_2_status === 'pending') {
      if (isAdmin || (user?.nip && user.nip === request.approver_2_nip)) {
        return 2;
      }
    }
    // Jika admin verifikasi masih pending
    if (request.admin_decision === 'pending' && isAdmin) {
      return 'admin';
    }

    if (request.approver_1_status === 'pending') return 1;
    if (request.approver_2_status === 'pending') return 2;
    return 'admin';
  };

  const [level, setLevel] = useState<1 | 2 | 'admin'>(1);
  const [decision, setDecision] = useState<'accepted' | 'rejected'>('accepted');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && request) {
      setLevel(resolveInitialLevel());
      setDecision('accepted');
      setNote('');
      setError(null);
      setBusy(false);
    }
  }, [isOpen, request]);

  if (!isOpen || !request) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (decision === 'rejected' && !note.trim()) {
      setError('Alasan / catatan penolakan wajib diisi bila permohonan ditolak.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (level === 'admin') {
        await api.decideAdmin(request.id, decision, note.trim() || undefined);
      } else {
        await api.decideApprover(request.id, level, decision, note.trim() || undefined);
      }
      const label =
        decision === 'accepted'
          ? 'disetujui'
          : 'ditolak';
      const roleLabel =
        level === 1
          ? 'Atasan 1'
          : level === 2
          ? 'Atasan 2 (Pejabat Berwenang)'
          : 'Admin Verifikasi';
      onSuccess(`Permohonan #${request.id} berhasil ${label} oleh ${roleLabel}.`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan keputusan.');
    } finally {
      setBusy(false);
    }
  };

  const levelName =
    level === 1
      ? 'Pertimbangan Atasan Langsung (Atasan 1)'
      : level === 2
      ? 'Keputusan Pejabat yang Berwenang Memberikan Cuti (Atasan 2)'
      : 'Verifikasi Admin Kepegawaian';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Putuskan Permohonan #{request.id}</span>
          <span className="badge" style={{ fontSize: '11px', textTransform: 'uppercase' }}>
            {level === 1 ? 'Atasan 1' : level === 2 ? 'Atasan 2' : 'Admin'}
          </span>
        </div>
      }
      subtitle={`Pemohon: ${request.name} ${request.nip ? `(${request.nip})` : ''}`}
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <Link
            to={`/leave/${request.id}`}
            className="sub"
            style={{ fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: 4 }}
            target="_blank"
          >
            Buka Halaman Detail <IconExternalLink size={13} />
          </Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="button secondary" onClick={onClose} disabled={busy}>
              Batal
            </button>
            <button
              type="button"
              className={decision === 'accepted' ? 'button primary' : 'button danger'}
              onClick={handleSubmit}
              disabled={busy || (level === 2 && request.approver_1_status !== 'accepted')}
            >
              {busy
                ? 'Menyimpan...'
                : decision === 'accepted'
                ? '✓ Setujui Permohonan'
                : '✕ Tolak Permohonan'}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Ringkasan Permohonan */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <div>
              <span className="sub" style={{ display: 'block', fontSize: '11.5px' }}>Jenis Cuti</span>
              <strong>{request.leave_type}</strong>
            </div>
            <div>
              <span className="sub" style={{ display: 'block', fontSize: '11.5px' }}>Durasi</span>
              <strong>{request.duration} {request.duration_unit}</strong>
            </div>
            <div>
              <span className="sub" style={{ display: 'block', fontSize: '11.5px' }}>Tanggal Pelaksanaan</span>
              <span>
                {formatDate(request.start_date)}
                {request.start_date !== request.end_date ? ` – ${formatDate(request.end_date)}` : ''}
              </span>
            </div>
            <div>
              <span className="sub" style={{ display: 'block', fontSize: '11.5px' }}>Status Saat Ini</span>
              <span className={leaveStatusTone(request.status)} style={{ fontWeight: 600 }}>
                {leaveStatusLabel(request.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Pemilihan Peran Pemutus (Jika Admin) */}
        {isAdmin ? (
          <div>
            <label className="sub" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Bertindak Sebagai:
            </label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={level === 1 ? 'button small primary' : 'button small secondary'}
                onClick={() => setLevel(1)}
              >
                Atasan 1 ({leaveStatusLabel(request.approver_1_status)})
              </button>
              <button
                type="button"
                className={level === 2 ? 'button small primary' : 'button small secondary'}
                onClick={() => setLevel(2)}
              >
                Atasan 2 ({leaveStatusLabel(request.approver_2_status)})
              </button>
              <button
                type="button"
                className={level === 'admin' ? 'button small primary' : 'button small secondary'}
                onClick={() => setLevel('admin')}
              >
                Admin ({leaveStatusLabel(request.admin_decision)})
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#334155' }}>
            Peran Anda: <strong>{levelName}</strong>
          </div>
        )}

        {level === 2 && request.approver_1_status !== 'accepted' ? (
          <div
            style={{
              padding: '10px 12px',
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 6,
              color: '#92400e',
              fontSize: '12.5px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: '16px' }}>⚠️</span>
            <span>
              <strong>Perhatian:</strong> Pertimbangan Atasan 1 saat ini masih{' '}
              <strong>{leaveStatusLabel(request.approver_1_status)}</strong>. Berdasarkan hierarki BKN,
              Atasan 1 harus menyetujui terlebih dahulu sebelum Atasan 2 dapat memutuskan.
            </span>
          </div>
        ) : null}

        {/* Pilihan Keputusan */}
        <div>
          <label className="sub" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
            Keputusan Anda:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <button
              type="button"
              className={decision === 'accepted' ? 'button ok' : 'button secondary'}
              style={{
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderColor: decision === 'accepted' ? '#0E6B4C' : undefined,
                background: decision === 'accepted' ? '#EBF8F2' : undefined,
                color: decision === 'accepted' ? '#0E6B4C' : undefined,
                fontWeight: 600,
              }}
              onClick={() => setDecision('accepted')}
            >
              <IconCheck size={18} />
              Setujui (ACC)
            </button>
            <button
              type="button"
              className={decision === 'rejected' ? 'button danger' : 'button secondary'}
              style={{
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderColor: decision === 'rejected' ? '#dc2626' : undefined,
                background: decision === 'rejected' ? '#fef2f2' : undefined,
                color: decision === 'rejected' ? '#dc2626' : undefined,
                fontWeight: 600,
              }}
              onClick={() => setDecision('rejected')}
            >
              <IconX size={18} />
              Tolak Permohonan
            </button>
          </div>
        </div>

        {/* Catatan / Pertimbangan */}
        <div>
          <label htmlFor="decision-note" className="sub" style={{ display: 'block', fontWeight: 600, marginBottom: 4 }}>
            Catatan / Pertimbangan {decision === 'rejected' ? <span style={{ color: '#dc2626' }}>* (wajib)</span> : '(opsional)'}:
          </label>
          <textarea
            id="decision-note"
            rows={3}
            placeholder={
              decision === 'rejected'
                ? 'Jelaskan alasan penolakan permohonan cuti ini...'
                : 'Tuliskan catatan pertimbangan cuti bila ada...'
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              width: '100%',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              padding: '8px 10px',
              fontFamily: 'inherit',
              fontSize: '13px',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error ? (
          <div
            style={{
              padding: '8px 12px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              color: '#b91c1c',
              fontSize: '13px',
            }}
          >
            {error}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

