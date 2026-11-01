import { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { Modal } from './Modal';
import { QuotaCard } from './Layout';
import { IconCalendarPlus } from './Icons';
import { ApproverFieldGroup } from './ApproverFieldGroup';

export interface LeaveApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (requestId: number) => void;
}

export function LeaveApplyModal({ isOpen, onClose, onSuccess }: LeaveApplyModalProps) {
  const [quota, setQuota] = useState<api.Quota | null>(null);
  const [options, setOptions] = useState<api.LeaveTypeOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [durationUnit] = useState('day');
  const [form, setForm] = useState({
    leave_type: 'Cuti Tahunan',
    duration: 1,
    start_date: '',
    end_date: '',
    reason: '',
    address: '',
    phone: '',
    approver_1_name: '',
    approver_1_nip: '',
    approver_1_position: '',
    approver_2_name: '',
    approver_2_nip: '',
    approver_2_position: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const year = form.start_date ? Number(form.start_date.slice(0, 4)) : undefined;

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    api
      .getLeaveTypeOptions()
      .then((value) => {
        if (!alive) return;
        setOptions(value.types);
        if (value.types.length > 0 && !value.types.some((t) => t.name === form.leave_type)) {
          setForm((prev) => ({ ...prev, leave_type: value.types[0].name }));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isOpen, form.leave_type]);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    api
      .getQuota(year)
      .then((value) => alive && setQuota(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [isOpen, year]);

  const rule = useMemo(
    () => options.find((option) => option.name === form.leave_type) ?? null,
    [options, form.leave_type],
  );

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const resetForm = () => {
    setForm({
      leave_type: options[0]?.name || 'Cuti Tahunan',
      duration: 1,
      start_date: '',
      end_date: '',
      reason: '',
      address: '',
      phone: '',
      approver_1_name: '',
      approver_1_nip: '',
      approver_1_position: '',
      approver_2_name: '',
      approver_2_nip: '',
      approver_2_position: '',
    });
    setFile(null);
    setError(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload: Parameters<typeof api.createLeaveRequest>[0] = {
        leave_type: form.leave_type,
        duration: Number(form.duration),
        duration_unit: durationUnit as 'day' | 'month' | 'year',
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        approver_1_name: form.approver_1_name || undefined,
        approver_1_nip: form.approver_1_nip || undefined,
        approver_1_position: form.approver_1_position || undefined,
        approver_2_name: form.approver_2_name || undefined,
        approver_2_nip: form.approver_2_nip || undefined,
        approver_2_position: form.approver_2_position || undefined,
      };

      let resultId: number;
      if (file) {
        const result = await api.createLeaveRequestWithAttachment(payload, file);
        resultId = result.id;
      } else {
        const result = await api.createLeaveRequest(payload);
        resultId = result.id;
      }

      resetForm();
      onSuccess(resultId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengajukan cuti');
    } finally {
      setBusy(false);
    }
  };

  const counts = form.leave_type === 'Cuti Tahunan' ? form.duration : 0;
  const simulation = quota
    ? {
        official: quota.official,
        reserved_days: quota.reserved_days + counts,
        reserved_count: quota.reserved_count + (counts > 0 ? 1 : 0),
        available: {
          n: Math.max(0, quota.available.n - counts),
          n1: quota.available.n1,
          n2: quota.available.n2,
          total: Math.max(0, quota.available.total - counts),
        },
        eligibility: quota.eligibility,
      }
    : null;

  const attachmentMissing = Boolean(rule?.requires_attachment) && !file;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="xl"
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <IconCalendarPlus size={20} style={{ color: '#0E6B4C' }} />
          <span>Ajukan Cuti Baru</span>
        </span>
      }
      subtitle="Pengisian formulir permohonan cuti ASN Kementerian Agama Kab. Sleman"
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            {attachmentMissing ? '⚠️ Jenis cuti ini memerlukan lampiran berkas pendukung.' : 'Data langsung divalidasi ke sistem kuota.'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="button secondary small" onClick={handleClose} disabled={busy}>
              Batal
            </button>
            <button
              type="submit"
              form="apply-leave-modal-form"
              className="button small"
              disabled={busy || !form.start_date || !form.end_date || attachmentMissing}
            >
              {busy ? 'Mengirim Permohonan...' : 'Kirim Permohonan Cuti'}
            </button>
          </div>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '20px' }}>
        <form id="apply-leave-modal-form" className="form" onSubmit={handleSubmit} style={{ margin: 0 }}>
          <label htmlFor="modal_leave_type" style={{ fontWeight: 600 }}>Jenis Cuti</label>
          <select
            id="modal_leave_type"
            value={form.leave_type}
            onChange={(event) => set('leave_type', event.target.value)}
          >
            {(options.length > 0
              ? options.map((option) => option.name)
              : ['Cuti Tahunan']
            ).map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>

          {rule ? (
            <p className="sub" style={{ fontSize: '12px', marginTop: '2px', color: '#475569' }}>
              {rule.description} Batas {rule.max_days} hari.
              {rule.consumes_quota ? ' Mengurangi kuota tahunan.' : ' Tidak mengurangi kuota tahunan.'}
            </p>
          ) : null}

          <div className="grid2" style={{ marginTop: '8px' }}>
            <div>
              <label htmlFor="modal_start_date" style={{ fontWeight: 600 }}>Tanggal Mulai</label>
              <input
                id="modal_start_date"
                type="date"
                value={form.start_date}
                required
                onChange={(event) => set('start_date', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="modal_end_date" style={{ fontWeight: 600 }}>Tanggal Selesai</label>
              <input
                id="modal_end_date"
                type="date"
                value={form.end_date}
                required
                onChange={(event) => set('end_date', event.target.value)}
              />
            </div>
          </div>

          <div style={{ marginTop: '8px' }}>
            <label htmlFor="modal_duration" style={{ fontWeight: 600 }}>Lama (hari kerja)</label>
            <input
              id="modal_duration"
              type="number"
              min={1}
              max={rule?.max_days || undefined}
              value={form.duration}
              required
              onChange={(event) => set('duration', Number(event.target.value))}
            />
          </div>

          <div style={{ marginTop: '8px' }}>
            <label htmlFor="modal_reason" style={{ fontWeight: 600 }}>Alasan Cuti</label>
            <textarea
              id="modal_reason"
              rows={2}
              placeholder="Jelaskan keperluan atau alasan mengajukan cuti..."
              value={form.reason}
              onChange={(event) => set('reason', event.target.value)}
            />
          </div>

          <div className="grid2" style={{ marginTop: '8px' }}>
            <div>
              <label htmlFor="modal_address" style={{ fontWeight: 600 }}>Alamat Selama Cuti</label>
              <input
                id="modal_address"
                placeholder="Alamat domisili saat cuti"
                value={form.address}
                onChange={(event) => set('address', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="modal_phone" style={{ fontWeight: 600 }}>Nomor Telepon / WhatsApp</label>
              <input
                id="modal_phone"
                placeholder="08xxxxxxxxxx"
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
              />
            </div>
          </div>

          <ApproverFieldGroup
            title="Atasan Langsung (Pertimbangan Cuti)"
            nameLabel="Nama Atasan 1"
            nipLabel="NIP Atasan 1"
            positionLabel="Jabatan Atasan 1"
            nameId="modal_approver_1_name"
            nipId="modal_approver_1_nip"
            positionId="modal_approver_1_position"
            nameValue={form.approver_1_name}
            nipValue={form.approver_1_nip}
            positionValue={form.approver_1_position}
            onNameChange={(val) => set('approver_1_name', val)}
            onNipChange={(val) => set('approver_1_nip', val)}
            onPositionChange={(val) => set('approver_1_position', val)}
            defaultPositionSuggestion="Kasubbag Tata Usaha"
          />

          <ApproverFieldGroup
            title="Pejabat yang Berwenang Memberikan Cuti"
            nameLabel="Nama Pejabat (Atasan 2)"
            nipLabel="NIP Pejabat"
            positionLabel="Jabatan Pejabat"
            nameId="modal_approver_2_name"
            nipId="modal_approver_2_nip"
            positionId="modal_approver_2_position"
            nameValue={form.approver_2_name}
            nipValue={form.approver_2_nip}
            positionValue={form.approver_2_position}
            onNameChange={(val) => set('approver_2_name', val)}
            onNipChange={(val) => set('approver_2_nip', val)}
            onPositionChange={(val) => set('approver_2_position', val)}
            defaultPositionSuggestion="Kepala Kantor Kementerian Agama Kab. Sleman"
          />

          <div style={{ marginTop: '12px' }}>
            <label htmlFor="modal_file" style={{ fontWeight: 600 }}>
              Lampiran Dokumen {rule?.requires_attachment ? '(Wajib)' : '(Opsional)'}
            </label>
            <input
              id="modal_file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
            <p className="sub" style={{ fontSize: '11.5px', marginTop: '3px' }}>
              Format PDF atau foto scan (JPG/PNG/WEBP), maks. 10 MB.
            </p>
          </div>

          {error ? (
            <div className="panel" style={{ marginTop: '12px', border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', padding: '10px 14px' }}>
              <p style={{ margin: 0, fontSize: '13px' }}>{error}</p>
            </div>
          ) : null}
        </form>

        <aside style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="panel" style={{ margin: 0, padding: '14px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 6px', fontSize: '13.5px', fontWeight: 700, color: '#1e293b' }}>Simulasi Kuota</h4>
            <p className="sub" style={{ fontSize: '11.5px', margin: '0 0 10px', color: '#64748b', lineHeight: 1.3 }}>
              Perkiraan sisa saldo jika permohonan ini disetujui.
            </p>

            {simulation ? (
              <div className="stats vertical" style={{ gap: '6px', margin: 0 }}>
                <QuotaCard label="Saldo tahun ini (N)" value={simulation.available.n} tone="ok" />
                <QuotaCard label="Sisa N-1" value={simulation.available.n1} />
                <QuotaCard label="Sisa N-2" value={simulation.available.n2} />
                <QuotaCard
                  label="Terpesan (Pending)"
                  value={simulation.reserved_days}
                  hint={`${simulation.reserved_count} permohonan`}
                  tone={simulation.reserved_days > 0 ? 'warn' : undefined}
                />
              </div>
            ) : (
              <p className="sub" style={{ fontSize: '12px', color: '#64748b' }}>Pilih tanggal mulai cuti untuk melihat simulasi kuota.</p>
            )}

            {simulation && !simulation.eligibility.eligible ? (
              <div style={{ marginTop: '10px', padding: '8px 10px', background: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '11.5px', color: '#92400e' }}>
                ⚠️ Belum memenuhi syarat kuota otomatis: {simulation.eligibility.reason}.
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </Modal>
  );
}

