import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Page } from '../components/Layout';
import { formatBytes } from '../format';
import * as api from '../api';

/** Detail agenda: data, laporan, dan berkas. */

const formatDateTime = (value: string | null): string => {
  if (!value) return '-';
  const iso = value.replace(' ', 'T');
  const [date, time] = iso.split('T');
  const [y, m, d] = (date ?? '').split('-');
  return `${d ?? ''}/${m ?? ''}/${y ?? ''} ${(time ?? '').slice(0, 5)}`;
};

export function AgendaDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const agendaId = Number(id);
  const fileInput = useRef<HTMLInputElement>(null);

  const [agenda, setAgenda] = useState<api.AgendaDetail | null>(null);
  const [report, setReport] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const detail = await api.getAgenda(agendaId);
      setAgenda(detail);
      setReport(detail.report ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat agenda');
    }
  }, [agendaId]);

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

  if (!agenda) {
    return (
      <Page title={`Agenda #${agendaId}`}>
        {error ? <p className="err">{error}</p> : <p className="sub">Memuat...</p>}
      </Page>
    );
  }

  return (
    <Page title={agenda.title} sub={`${agenda.name ?? '-'} · ${formatDateTime(agenda.start_at)}`}>
      <div className="toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate('/agenda')}>
          Kembali
        </button>
        <button className="button secondary small" type="button" onClick={() => navigate(`/agenda/${agenda.id}/edit`)}>
          Ubah
        </button>
        <button
          className="button danger small"
          type="button"
          disabled={busy}
          onClick={() => {
            if (!window.confirm('Hapus agenda ini?')) return;
            void run(async () => {
              await api.deleteAgenda(agenda.id);
              navigate('/agenda');
            }, 'Dihapus');
          }}
        >
          Hapus
        </button>
      </div>

      {notice ? <p className="ok">{notice}</p> : null}
      {error ? <p className="err">{error}</p> : null}

      <div className="panel">
        <dl className="kv">
          <dt>Kegiatan</dt>
          <dd>{agenda.title}</dd>
          <dt>Tempat</dt>
          <dd>{agenda.place ?? '-'}</dd>
          <dt>Mulai</dt>
          <dd>{formatDateTime(agenda.start_at)}</dd>
          <dt>Selesai</dt>
          <dd>{formatDateTime(agenda.end_at)}</dd>
          <dt>Nama</dt>
          <dd>{agenda.name ?? '-'}</dd>
          <dt>NIP</dt>
          <dd>{agenda.nip ?? '-'}</dd>
        </dl>
      </div>

      <div className="panel">
        <h2>Laporan</h2>
        <textarea rows={4} value={report} onChange={(event) => setReport(event.target.value)} />
        <div className="actions">
          <button
            className="button"
            type="button"
            disabled={busy || !report.trim()}
            onClick={() => void run(() => api.setAgendaReport(agenda.id, report.trim()), 'Laporan tersimpan.')}
          >
            Simpan laporan
          </button>
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
            if (file) void run(() => api.uploadAgendaFile(agenda.id, file), 'Berkas tersimpan.');
            event.target.value = '';
          }}
        />

        <h3>Berkas laporan</h3>
        {agenda.documents.length === 0 ? <p className="sub">Belum ada berkas.</p> : null}
        <ul className="docs">
          {agenda.documents.map((doc) => (
            <li key={doc.id}>
              <span>{doc.original_filename}</span>
              <span className="sub">{formatBytes(doc.size_bytes)}</span>
              <button className="button secondary small" type="button" onClick={() => void download(doc.id)}>
                Unduh
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Page>
  );
}
