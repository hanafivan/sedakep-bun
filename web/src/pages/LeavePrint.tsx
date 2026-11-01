import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../api';
import { LeaveSkDocument } from '../components/LeaveSkDocument';

/**
 * Tampilan cetak surat keterangan cuti.
 * Cerminan `cetak_sk.php`/`cetak_sk_pdf.php`.
 */
export function LeavePrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<api.LeaveRequestDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getLeaveRequestDetail(Number(id))
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat permohonan');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (data) window.print();
  }, [data]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="sub">Memuat surat keterangan cuti...</p>;

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak SK
        </button>
      </div>

      <LeaveSkDocument data={data} />
    </div>
  );
}
