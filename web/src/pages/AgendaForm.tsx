import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Form tambah/ubah agenda. */

const toInput = (value: string | null): string =>
  value ? value.slice(0, 16).replace(' ', 'T') : '';

export function AgendaForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const [form, setForm] = useState({ title: '', place: '', start_at: '', end_at: '', report: '' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const agenda = await api.getAgenda(Number(id));
        if (!alive) return;
        setForm({
          title: agenda.title ?? '',
          place: agenda.place ?? '',
          start_at: toInput(agenda.start_at),
          end_at: toInput(agenda.end_at),
          report: agenda.report ?? '',
        });
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat agenda');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  const submit = async () => {
    if (!form.title.trim()) {
      setError('Judul agenda wajib diisi.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload: api.AgendaPayload = { title: form.title.trim() };
    if (form.place) payload.place = form.place;
    if (form.start_at) payload.start_at = form.start_at;
    if (form.end_at) payload.end_at = form.end_at;
    if (form.report) payload.report = form.report;
    try {
      if (id) {
        await api.updateAgenda(Number(id), payload);
        navigate(`/agenda/${id}`);
      } else {
        const created = await api.createAgenda(payload);
        navigate(`/agenda/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan agenda');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={editing ? `Ubah Agenda #${id}` : 'Tambah Agenda'}>
      {loading ? <p className="sub">Memuat...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {!loading ? (
        <div className="panel">
          <label>Judul / kegiatan</label>
          <input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
          />
          <label>Tempat</label>
          <input value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} />
          <div className="grid2">
            <div>
              <label>Mulai</label>
              <input
                type="datetime-local"
                value={form.start_at}
                onChange={(event) => setForm({ ...form, start_at: event.target.value })}
              />
            </div>
            <div>
              <label>Selesai</label>
              <input
                type="datetime-local"
                value={form.end_at}
                onChange={(event) => setForm({ ...form, end_at: event.target.value })}
              />
            </div>
          </div>
          <label>Laporan (opsional)</label>
          <textarea
            rows={3}
            value={form.report}
            onChange={(event) => setForm({ ...form, report: event.target.value })}
          />

          <div className="actions">
            <button type="button" className="button" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Tambah agenda'}
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
