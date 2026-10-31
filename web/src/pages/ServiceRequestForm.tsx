import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import * as api from '../api';

/**
 * Form buat/ubah permohonan layanan. Field mengikuti metadata jenis layanan
 * (mis. pensiun punya tempat_lahir, jenis pensiun, dst).
 */

export function ServiceRequestForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editing = Boolean(id);

  const [meta, setMeta] = useState<api.ServiceTypeMeta[]>([]);
  const [serviceType, setServiceType] = useState(params.get('type') ?? '');
  const [header, setHeader] = useState({ title: '', phone: '', subtype: '', approver_1_name: '', approver_1_nip: '', approver_1_position: '' });
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const value = await api.getServiceMeta();
        if (!alive) return;
        setMeta(value.types);
        if (editing) {
          const detail = await api.getServiceRequest(Number(id));
          if (!alive) return;
          setServiceType(detail.service_type);
          setHeader({
            title: detail.title ?? '',
            phone: detail.phone ?? '',
            subtype: detail.subtype ?? '',
            approver_1_name: detail.approver_1_name ?? '',
            approver_1_nip: detail.approver_1_nip ?? '',
            approver_1_position: detail.approver_1_position ?? '',
          });
          const next: Record<string, string> = {};
          for (const [key, value] of Object.entries(detail.fields)) next[key] = value ?? '';
          setFields(next);
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat data');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, editing]);

  const def = meta.find((item) => item.type === serviceType) ?? null;

  const submit = async () => {
    if (!serviceType) {
      setError('Pilih jenis layanan.');
      return;
    }
    setBusy(true);
    setError(null);
    const filled: Record<string, string> = {};
    for (const [key, value] of Object.entries(fields)) if (value) filled[key] = value;
    const payload: api.ServiceRequestPayload = {
      service_type: serviceType,
      ...Object.fromEntries(Object.entries(header).filter(([, value]) => value)),
      fields: filled,
    };
    try {
      if (id) {
        await api.updateServiceRequest(Number(id), payload);
        navigate(`/services/${id}`);
      } else {
        const created = await api.createServiceRequest(payload);
        navigate(`/services/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan permohonan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title={editing ? `Ubah Layanan #${id}` : 'Buat Permohonan Layanan'}>
      {loading ? <p className="sub">Memuat...</p> : null}
      {error ? <p className="err">{error}</p> : null}

      {!loading ? (
        <div className="panel">
          <label>Jenis layanan</label>
          <select
            value={serviceType}
            disabled={editing}
            onChange={(event) => {
              setServiceType(event.target.value);
              setFields({});
            }}
          >
            <option value="">— pilih —</option>
            {meta.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label}
              </option>
            ))}
          </select>

          <label>Judul / keterangan</label>
          <input value={header.title} onChange={(event) => setHeader({ ...header, title: event.target.value })} />

          {def?.subtype_label ? (
            <>
              <label>{def.subtype_label}</label>
              <select value={header.subtype} onChange={(event) => setHeader({ ...header, subtype: event.target.value })}>
                <option value="">— pilih —</option>
                {def.subtype_options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </>
          ) : null}

          <label>Telepon</label>
          <input value={header.phone} onChange={(event) => setHeader({ ...header, phone: event.target.value })} />

          {def && def.fields.length > 0 ? (
            <>
              <h3>Data {def.label}</h3>
              <div className="grid2">
                {def.fields.map((field) => (
                  <div key={field.key}>
                    <label>{field.label}</label>
                    {field.kind === 'textarea' ? (
                      <textarea
                        rows={2}
                        value={fields[field.key] ?? ''}
                        onChange={(event) => setFields({ ...fields, [field.key]: event.target.value })}
                      />
                    ) : (
                      <input
                        type={field.kind === 'date' ? 'date' : 'text'}
                        value={fields[field.key] ?? ''}
                        onChange={(event) => setFields({ ...fields, [field.key]: event.target.value })}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : null}

          <h3>Atasan</h3>
          <div className="grid2">
            <input
              placeholder="Nama atasan"
              value={header.approver_1_name}
              onChange={(event) => setHeader({ ...header, approver_1_name: event.target.value })}
            />
            <input
              placeholder="NIP atasan"
              value={header.approver_1_nip}
              onChange={(event) => setHeader({ ...header, approver_1_nip: event.target.value })}
            />
            <input
              placeholder="Jabatan atasan"
              value={header.approver_1_position}
              onChange={(event) => setHeader({ ...header, approver_1_position: event.target.value })}
            />
          </div>

          <div className="actions">
            <button type="button" className="button" disabled={busy} onClick={() => void submit()}>
              {busy ? 'Menyimpan...' : editing ? 'Simpan perubahan' : 'Kirim permohonan'}
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
