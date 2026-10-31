import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import * as api from '../api';

/** Form buat/ubah alibi. */

type FormState = {
  alibi_type: string;
  alibi_date: string;
  day_count: string;
  reason: string;
  time_start: string;
  time_end: string;
  approver_1_name: string;
  approver_1_nip: string;
  approver_1_position: string;
  approver_2_name: string;
  approver_2_nip: string;
  approver_2_position: string;
};

const EMPTY: FormState = {
  alibi_type: '',
  alibi_date: '',
  day_count: '',
  reason: '',
  time_start: '',
  time_end: '',
  approver_1_name: '',
  approver_1_nip: '',
  approver_1_position: '',
  approver_2_name: '',
  approver_2_nip: '',
  approver_2_position: '',
};

const TYPES = ['Tidak masuk', 'Terlambat', 'Pulang cepat', 'Keluar kantor'];

export function AlibiForm() {
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
        const alibi = await api.getAlibiRequest(Number(id));
        if (!alive) return;
        setForm({
          alibi_type: alibi.alibi_type ?? '',
          alibi_date: alibi.alibi_date?.slice(0, 10) ?? '',
          day_count: alibi.day_count ?? '',
          reason: alibi.reason ?? '',
          time_start: alibi.time_start ?? '',
          time_end: alibi.time_end ?? '',
          approver_1_name: alibi.approver_1_name ?? '',
          approver_1_nip: alibi.approver_1_nip ?? '',
          approver_1_position: alibi.approver_1_position ?? '',
          approver_2_name: alibi.approver_2_name ?? '',
          approver_2_nip: alibi.approver_2_nip ?? '',
          approver_2_position: alibi.approver_2_position ?? '',
        });
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat alibi');
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
    const payload: api.AlibiPayload = {};
    for (const [key, value] of Object.entries(form)) {
      if (value) payload[key as keyof api.AlibiPayload] = value;
    }
    try {
      if (id) {
        await api.updateAlibiRequest(Number(id), payload);
        navigate(`/alibi/${id}`);
      } else {
        const created = await api.createAlibiRequest(payload);
        navigate(`/alibi/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan alibi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={editing ? `Ubah Alibi #${id}` : 'Ajukan Alibi'}>
      {loading ? <p className="sub">Memuat...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {!loading ? (
        <div className="panel">
          <div className="grid2">
            <div>
              <label>Jenis alibi</label>
              <select value={form.alibi_type} onChange={(event) => set('alibi_type', event.target.value)}>
                <option value="">— pilih —</option>
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Tanggal</label>
              <input
                type="date"
                value={form.alibi_date}
                onChange={(event) => set('alibi_date', event.target.value)}
              />
            </div>
            <div>
              <label>Jumlah hari</label>
              <input value={form.day_count} onChange={(event) => set('day_count', event.target.value)} />
            </div>
            <div>
              <label>Jam mulai</label>
              <input value={form.time_start} onChange={(event) => set('time_start', event.target.value)} />
            </div>
            <div>
              <label>Jam selesai</label>
              <input value={form.time_end} onChange={(event) => set('time_end', event.target.value)} />
            </div>
          </div>

          <label>Alasan</label>
          <textarea rows={3} value={form.reason} onChange={(event) => set('reason', event.target.value)} />

          <h3>Atasan 1</h3>
          <div className="grid2">
            <input
              placeholder="Nama atasan 1"
              value={form.approver_1_name}
              onChange={(event) => set('approver_1_name', event.target.value)}
            />
            <input
              placeholder="NIP atasan 1"
              value={form.approver_1_nip}
              onChange={(event) => set('approver_1_nip', event.target.value)}
            />
            <input
              placeholder="Jabatan atasan 1"
              value={form.approver_1_position}
              onChange={(event) => set('approver_1_position', event.target.value)}
            />
          </div>

          <h3>Atasan 2</h3>
          <div className="grid2">
            <input
              placeholder="Nama atasan 2"
              value={form.approver_2_name}
              onChange={(event) => set('approver_2_name', event.target.value)}
            />
            <input
              placeholder="NIP atasan 2"
              value={form.approver_2_nip}
              onChange={(event) => set('approver_2_nip', event.target.value)}
            />
            <input
              placeholder="Jabatan atasan 2"
              value={form.approver_2_position}
              onChange={(event) => set('approver_2_position', event.target.value)}
            />
          </div>

          <div className="actions">
            <button type="button" className="button" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Ajukan alibi'}
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
