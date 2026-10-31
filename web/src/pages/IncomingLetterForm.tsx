import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Form catat/ubah surat masuk. */

type FormState = {
  agenda_number: string;
  ticket_number: string;
  letter_number: string;
  origin: string;
  content: string;
  classification_code: string;
  index_code: string;
  letter_date: string;
  received_date: string;
  owner_name: string;
  owner_nip: string;
  notes: string;
};

const EMPTY: FormState = {
  agenda_number: '',
  ticket_number: '',
  letter_number: '',
  origin: '',
  content: '',
  classification_code: '',
  index_code: '',
  letter_date: '',
  received_date: '',
  owner_name: '',
  owner_nip: '',
  notes: '',
};

export function IncomingLetterForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [classifications, setClassifications] = useState<api.LetterClassification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    api.listClassifications({ active_only: 'true' }).then(setClassifications).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const letter = await api.getIncomingLetter(Number(id));
        if (!alive) return;
        setForm({
          agenda_number: letter.agenda_number ?? '',
          ticket_number: letter.ticket_number ?? '',
          letter_number: letter.letter_number ?? '',
          origin: letter.origin ?? '',
          content: letter.content ?? '',
          classification_code: letter.classification_code ?? '',
          index_code: letter.index_code ?? '',
          letter_date: letter.letter_date?.slice(0, 10) ?? '',
          received_date: letter.received_date?.slice(0, 10) ?? '',
          owner_name: letter.owner_name ?? '',
          owner_nip: letter.owner_nip ?? '',
          notes: letter.notes ?? '',
        });
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat surat masuk');
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
    const payload: api.IncomingLetterPayload = {};
    for (const [key, value] of Object.entries(form)) {
      if (value) payload[key as keyof api.IncomingLetterPayload] = value;
    }
    try {
      if (id) {
        await api.updateIncomingLetter(Number(id), payload);
        navigate(`/incoming-letters/${id}`);
      } else {
        const created = await api.createIncomingLetter(payload);
        navigate(`/incoming-letters/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan surat masuk');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={editing ? `Ubah Surat Masuk #${id}` : 'Catat Surat Masuk'}>
      {loading ? <p className="sub">Memuat...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {!loading ? (
        <div className="panel">
          <div className="grid2">
            <div>
              <label>Nomor agenda</label>
              <input value={form.agenda_number} onChange={(event) => set('agenda_number', event.target.value)} />
            </div>
            <div>
              <label>Nomor tiket</label>
              <input value={form.ticket_number} onChange={(event) => set('ticket_number', event.target.value)} />
            </div>
            <div>
              <label>Nomor surat</label>
              <input value={form.letter_number} onChange={(event) => set('letter_number', event.target.value)} />
            </div>
            <div>
              <label>Asal surat</label>
              <input value={form.origin} onChange={(event) => set('origin', event.target.value)} />
            </div>
            <div>
              <label>Tanggal surat</label>
              <input type="date" value={form.letter_date} onChange={(event) => set('letter_date', event.target.value)} />
            </div>
            <div>
              <label>Tanggal diterima</label>
              <input
                type="date"
                value={form.received_date}
                onChange={(event) => set('received_date', event.target.value)}
              />
            </div>
            <div>
              <label>Klasifikasi</label>
              <input
                list="classification-options"
                value={form.classification_code}
                onChange={(event) => set('classification_code', event.target.value)}
              />
              <datalist id="classification-options">
                {classifications.map((item) => (
                  <option key={item.id} value={item.code}>
                    {item.name}
                  </option>
                ))}
              </datalist>
            </div>
            <div>
              <label>Indeks</label>
              <input value={form.index_code} onChange={(event) => set('index_code', event.target.value)} />
            </div>
            <div>
              <label>Nama tujuan</label>
              <input value={form.owner_name} onChange={(event) => set('owner_name', event.target.value)} />
            </div>
            <div>
              <label>NIP tujuan</label>
              <input value={form.owner_nip} onChange={(event) => set('owner_nip', event.target.value)} />
            </div>
          </div>

          <label>Isi surat</label>
          <textarea rows={3} value={form.content} onChange={(event) => set('content', event.target.value)} />
          <label>Keterangan</label>
          <textarea rows={2} value={form.notes} onChange={(event) => set('notes', event.target.value)} />

          <div className="actions">
            <button type="button" className="button" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Catat surat masuk'}
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
