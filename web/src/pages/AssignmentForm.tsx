import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Form buat/ubah header surat tugas. Anggota/keterangan/tembusan di halaman detail. */

type FormState = {
  code: string;
  start_date: string;
  end_date: string;
  day_start: string;
  day_end: string;
  place: string;
  time_start: string;
  time_end: string;
  signer_name: string;
  signer_position: string;
  consideration: string;
  legal_basis: string;
  content: string;
  footnote: string;
};

const EMPTY: FormState = {
  code: '',
  start_date: '',
  end_date: '',
  day_start: '',
  day_end: '',
  place: '',
  time_start: '',
  time_end: '',
  signer_name: '',
  signer_position: '',
  consideration: '',
  legal_basis: '',
  content: '',
  footnote: '',
};

export function AssignmentForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const letter = await api.getAssignmentLetter(Number(id));
        if (!alive) return;
        setForm({
          code: letter.code ?? '',
          start_date: letter.start_date?.slice(0, 10) ?? '',
          end_date: letter.end_date?.slice(0, 10) ?? '',
          day_start: letter.day_start ?? '',
          day_end: letter.day_end ?? '',
          place: letter.place ?? '',
          time_start: letter.time_start ?? '',
          time_end: letter.time_end ?? '',
          signer_name: letter.signer_name ?? '',
          signer_position: letter.signer_position ?? '',
          consideration: letter.consideration ?? '',
          legal_basis: letter.legal_basis ?? '',
          content: letter.content ?? '',
          footnote: letter.footnote ?? '',
        });
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat surat tugas');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    const payload: api.CreateAssignmentPayload = {};
    for (const [key, value] of Object.entries(form)) {
      if (value) payload[key as keyof api.CreateAssignmentPayload] = value;
    }
    try {
      if (id) {
        await api.updateAssignmentLetter(Number(id), payload);
        navigate(`/assignments/${id}`);
      } else {
        const created = await api.createAssignmentLetter(payload);
        navigate(`/assignments/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan surat tugas');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page
      title={editing ? `Ubah Surat Tugas #${id}` : 'Buat Surat Tugas'}
      sub="Header surat; anggota, keterangan, dan tembusan ditambahkan di halaman detail"
    >
      {loading ? <p className="sub">Memuat...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {!loading ? (
        <div className="panel">
          <div className="grid2">
            <div>
              <label>Kode</label>
              <input value={form.code} onChange={(event) => set('code', event.target.value)} />
            </div>
            <div>
              <label>Tempat</label>
              <input value={form.place} onChange={(event) => set('place', event.target.value)} />
            </div>
            <div>
              <label>Tanggal mulai</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(event) => set('start_date', event.target.value)}
              />
            </div>
            <div>
              <label>Tanggal selesai</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(event) => set('end_date', event.target.value)}
              />
            </div>
            <div>
              <label>Hari mulai</label>
              <input value={form.day_start} onChange={(event) => set('day_start', event.target.value)} />
            </div>
            <div>
              <label>Hari selesai</label>
              <input value={form.day_end} onChange={(event) => set('day_end', event.target.value)} />
            </div>
            <div>
              <label>Jam mulai</label>
              <input value={form.time_start} onChange={(event) => set('time_start', event.target.value)} />
            </div>
            <div>
              <label>Jam selesai</label>
              <input value={form.time_end} onChange={(event) => set('time_end', event.target.value)} />
            </div>
            <div>
              <label>Nama penanda tangan</label>
              <input
                value={form.signer_name}
                onChange={(event) => set('signer_name', event.target.value)}
              />
            </div>
            <div>
              <label>Jabatan penanda tangan</label>
              <input
                value={form.signer_position}
                onChange={(event) => set('signer_position', event.target.value)}
              />
            </div>
          </div>

          <label>Pertimbangan</label>
          <textarea
            rows={2}
            value={form.consideration}
            onChange={(event) => set('consideration', event.target.value)}
          />
          <label>Dasar hukum</label>
          <textarea
            rows={2}
            value={form.legal_basis}
            onChange={(event) => set('legal_basis', event.target.value)}
          />
          <label>Isi tugas</label>
          <textarea
            rows={3}
            value={form.content}
            onChange={(event) => set('content', event.target.value)}
          />
          <label>Catatan bawah</label>
          <textarea
            rows={2}
            value={form.footnote}
            onChange={(event) => set('footnote', event.target.value)}
          />

          <div className="actions">
            <button type="button" className="button" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Buat surat tugas'}
            </button>
            <button type="button" className="button secondary" onClick={() => navigate(-1)}>
              Batal
            </button>
          </div>
        </div>
      ) : null}
    </Page>
  );
}
