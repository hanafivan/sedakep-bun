import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page, QuotaCard } from '../components/Layout';
import * as api from '../api';
import { ApproverFieldGroup } from '../components/ApproverFieldGroup';

/** Form permohonan cuti dengan simulasi kuota dari API (bukan hitungan klien). */

export function LeaveForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [quota, setQuota] = useState<api.Quota | null>(null);
  const [options, setOptions] = useState<api.LeaveTypeOption[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [durationUnit, setDurationUnit] = useState('day');
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

  // Jenis cuti datang dari API: aturan per jenis (wajib lampiran, batas hari,
  // apakah mengurangi kuota) berbeda antar pegawai, terutama untuk PPPK.
  useEffect(() => {
    let alive = true;
    api
      .getLeaveTypeOptions()
      .then((value) => {
        if (!alive) return;
        setOptions(value.types);
        if (!id && value.types.length > 0 && !value.types.some((t) => t.name === form.leave_type)) {
          setForm((prev) => ({ ...prev, leave_type: value.types[0].name }));
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    api
      .getQuota(year)
      .then((value) => alive && setQuota(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [year]);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    setBusy(true);
    api
      .getLeaveRequestDetail(Number(id))
      .then((detail) => {
        if (!alive) return;
        const source = detail as unknown as Record<string, unknown>;
        setForm({
          leave_type: String(detail.leave_type ?? ''),
          duration: Number(detail.duration ?? 1),
          start_date: String(detail.start_date ?? ''),
          end_date: String(detail.end_date ?? ''),
          reason: String(detail.reason ?? ''),
          address: String(source.address ?? ''),
          phone: String(source.phone ?? ''),
          approver_1_name: String(source.approver_1_name ?? ''),
          approver_1_nip: String(source.approver_1_nip ?? ''),
          approver_1_position: String(source.approver_1_position ?? ''),
          approver_2_name: String(source.approver_2_name ?? ''),
          approver_2_nip: String(source.approver_2_nip ?? ''),
          approver_2_position: String(source.approver_2_position ?? ''),
        });
        setDurationUnit(String(detail.duration_unit ?? 'day'));
      })
      .catch(() => {
        if (alive) setError('Gagal memuat permohonan');
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const rule = useMemo(
    () => options.find((option) => option.name === form.leave_type) ?? null,
    [options, form.leave_type],
  );

  const set = (key: keyof typeof form, value: string | number) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event: React.FormEvent) => {
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

      if (editing) {
        await api.updateLeaveRequest(Number(id), payload);
        navigate(`/leave/${id}`);
        return;
      }

      if (file) {
        // Lampiran dikirim sekaligus saat mengajukan; kalau jenis cuti mewajibkan
        // lampiran, server menolak pengajuan tanpa berkas.
        const result = await api.createLeaveRequestWithAttachment(payload, file);
        navigate(`/leave/${result.id}`);
        return;
      }

      const result = await api.createLeaveRequest(payload);
      navigate(`/leave/${result.id}`);
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

  const attachmentMissing = !editing && Boolean(rule?.requires_attachment) && !file;

  return (
    <Page
      title={editing ? 'Ubah Cuti' : 'Ajukan Cuti'}
      sub={editing ? 'Perbarui pengajuan; kuota divalidasi ulang di server' : 'Pengajuan baru; kuota divalidasi ulang di server'}
    >
      <div className="split">
        <form className="panel form" onSubmit={submit}>
          <label htmlFor="leave_type">Jenis cuti</label>
          <select
            id="leave_type"
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
            <p className="sub">
              {rule.description} Batas {rule.max_days} hari.
              {rule.consumes_quota ? ' Mengurangi kuota tahunan.' : ' Tidak mengurangi kuota tahunan.'}
            </p>
          ) : null}

          <div className="grid2">
            <div>
              <label htmlFor="start_date">Tanggal mulai</label>
              <input
                id="start_date"
                type="date"
                value={form.start_date}
                onChange={(event) => set('start_date', event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="end_date">Tanggal selesai</label>
              <input
                id="end_date"
                type="date"
                value={form.end_date}
                onChange={(event) => set('end_date', event.target.value)}
              />
            </div>
          </div>

          <label htmlFor="duration">Lama (hari)</label>
          <input
            id="duration"
            type="number"
            min={1}
            max={rule?.max_days || undefined}
            value={form.duration}
            onChange={(event) => set('duration', Number(event.target.value))}
          />

          <label htmlFor="reason">Alasan</label>
          <textarea
            id="reason"
            rows={3}
            value={form.reason}
            onChange={(event) => set('reason', event.target.value)}
          />

          <label htmlFor="address">Alamat selama cuti</label>
          <input
            id="address"
            value={form.address}
            onChange={(event) => set('address', event.target.value)}
          />

          <label htmlFor="phone">Telepon</label>
          <input
            id="phone"
            value={form.phone}
            onChange={(event) => set('phone', event.target.value)}
          />

          <ApproverFieldGroup
            title="Atasan Langsung (Pertimbangan Cuti)"
            nameLabel="Nama Atasan 1"
            nipLabel="NIP Atasan 1"
            positionLabel="Jabatan Atasan 1"
            nameId="approver_1_name"
            nipId="approver_1_nip"
            positionId="approver_1_position"
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
            nameId="approver_2_name"
            nipId="approver_2_nip"
            positionId="approver_2_position"
            nameValue={form.approver_2_name}
            nipValue={form.approver_2_nip}
            positionValue={form.approver_2_position}
            onNameChange={(val) => set('approver_2_name', val)}
            onNipChange={(val) => set('approver_2_nip', val)}
            onPositionChange={(val) => set('approver_2_position', val)}
            defaultPositionSuggestion="Kepala Kantor Kementerian Agama Kab. Sleman"
          />


          <label htmlFor="file">
            Lampiran {rule?.requires_attachment ? '(wajib)' : '(opsional)'}
          </label>
          <input
            id="file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp,image/heic"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <p className="sub">PDF atau foto pindaian (JPG/PNG/WEBP/HEIC), maksimal 10 MB.</p>

          {error ? <p className="err">{error}</p> : null}

          <div className="form-actions">
            <button
              type="submit"
              className="button"
              disabled={busy || !form.start_date || !form.end_date || attachmentMissing}
            >
              {busy ? 'Mengirim...' : 'Ajukan permohonan'}
            </button>
            <button
              type="button"
              className="button secondary"
              onClick={() => navigate(-1)}
            >
              Batal
            </button>
          </div>
          {attachmentMissing ? (
            <p className="sub">Lampirkan dokumen pendukung dulu — jenis cuti ini mewajibkannya.</p>
          ) : null}
        </form>

        <aside className="panel">
          <h2>Simulasi kuota</h2>
          <p className="sub">
            Angka resmi dari API; baris ini hanya memperhitungkan permohonan yang sedang diisi.
          </p>
          {simulation ? (
            <div className="stats vertical">
              <QuotaCard label="Saldo tahun ini" value={simulation.available.n} tone="ok" />
              <QuotaCard label="Sisa N-1" value={simulation.available.n1} />
              <QuotaCard label="Sisa N-2" value={simulation.available.n2} />
              <QuotaCard
                label="Terpesan"
                value={simulation.reserved_days}
                hint={`${simulation.reserved_count} permohonan`}
                tone={simulation.reserved_days > 0 ? 'warn' : undefined}
              />
            </div>
          ) : (
            <p className="sub">Isi tanggal mulai untuk melihat saldo.</p>
          )}
          {simulation && !simulation.eligibility.eligible ? (
            <p className="warn-note">
              Belum memenuhi syarat: {simulation.eligibility.reason}. Ajukan ke admin untuk
              validasi manual.
            </p>
          ) : null}
        </aside>
      </div>
    </Page>
  );
}
