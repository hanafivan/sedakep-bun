import { useEffect, useState } from 'react';
import * as api from '../api';
import { Modal } from './Modal';
import { LeaveFormDocument } from './LeaveFormDocument';
import { IconExternalLink, IconPrinter } from './Icons';

export interface LeaveFormModalProps {
  requestId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeaveFormModal({ requestId, isOpen, onClose }: LeaveFormModalProps) {
  const [data, setData] = useState<api.LeaveRequestDetail | null>(null);
  const [quota, setQuota] = useState<api.Quota | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !requestId) {
      setData(null);
      setQuota(null);
      setError(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    api
      .getLeaveRequestDetail(requestId)
      .then((detail) => {
        if (!alive) return;
        setData(detail);
        const year = detail.start_date ? new Date(detail.start_date).getFullYear() : new Date().getFullYear();
        return api.getQuotaFor(detail.user_id, year).then((q) => {
          if (alive) setQuota(q);
        });
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat formulir cuti');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isOpen, requestId]);

  const handlePrint = () => {
    document.body.classList.add('modal-printing');
    window.print();
    const cleanup = () => {
      document.body.classList.remove('modal-printing');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 1500);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      title="Formulir Permintaan dan Pemberian Cuti"
      subtitle="Anak Lampiran 1.b Peraturan BKN No. 24 Tahun 2017"
      headerActions={
        requestId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={`/leave/${requestId}/print-form`}
              target="_blank"
              rel="noreferrer"
              className="button secondary small"
              title="Buka tampilan cetak di tab baru"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px' }}
            >
              <IconExternalLink size={15} />
              <span>Tab Baru</span>
            </a>
            <button
              type="button"
              className="button small"
              onClick={handlePrint}
              disabled={loading || !data}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px' }}
            >
              <IconPrinter size={16} />
              <span>Cetak Formulir</span>
            </button>
          </div>
        ) : null
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Formulir otomatis disesuaikan dengan format resmi BKN 1 Halaman A4.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="button secondary small" onClick={onClose}>
              Tutup
            </button>
            <button
              type="button"
              className="button small"
              onClick={handlePrint}
              disabled={loading || !data}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <IconPrinter size={16} />
              <span>Cetak Formulir</span>
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Memuat formulir cuti...</p>
        </div>
      ) : error ? (
        <div className="panel" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : data ? (
        <div className="modal-doc-preview">
          <LeaveFormDocument data={data} quota={quota} />
        </div>
      ) : null}
    </Modal>
  );
}

