import { useEffect, useState } from 'react';
import * as api from '../api';
import { Modal } from './Modal';
import { LeaveSkDocument } from './LeaveSkDocument';
import { IconExternalLink, IconPrinter } from './Icons';

export interface LeaveSkModalProps {
  requestId: number | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeaveSkModal({ requestId, isOpen, onClose }: LeaveSkModalProps) {
  const [data, setData] = useState<api.LeaveRequestDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !requestId) {
      setData(null);
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
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat surat keterangan cuti');
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

  const letter = data?.letters.find((item) => item.letter_type === 'suket') ?? data?.letters[0] ?? null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Surat Keterangan Cuti (SK)"
      subtitle={letter?.number ? `Nomor: ${letter.number}` : 'Pratinjau Surat Keterangan'}
      headerActions={
        requestId ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a
              href={`/leave/${requestId}/print`}
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
              <span>Cetak SK</span>
            </button>
          </div>
        ) : null
      }
      footer={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontSize: '12px', color: '#64748b' }}>
            Surat keputusan resmi Kantor Kementerian Agama Kabupaten Sleman.
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
              <span>Cetak SK</span>
            </button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 16px', color: '#64748b' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Memuat surat keterangan cuti...</p>
        </div>
      ) : error ? (
        <div className="panel" style={{ border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c' }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : data ? (
        <div className="modal-doc-preview">
          <LeaveSkDocument data={data} />
        </div>
      ) : null}
    </Modal>
  );
}

