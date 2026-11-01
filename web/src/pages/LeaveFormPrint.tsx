import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as api from '../api';
import { LeaveFormDocument } from '../components/LeaveFormDocument';

/**
 * Tampilan cetak Formulir Permohonan Cuti BKN (Anak Lampiran 1.b Peraturan BKN No. 24/2017).
 * Cerminan langsung dari `cetak.php` pada legacy Sedakep.
 */
export function LeaveFormPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<api.LeaveRequestDetail | null>(null);
  const [quota, setQuota] = useState<api.Quota | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getLeaveRequestDetail(Number(id))
      .then((detail) => {
        if (!alive) return;
        setData(detail);
        const year = detail.start_date ? new Date(detail.start_date).getFullYear() : new Date().getFullYear();
        return api.getQuotaFor(detail.user_id, year).then((q) => {
          if (alive) setQuota(q);
        });
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat permohonan');
      });

    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    if (data) {
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [data]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="sub">Memuat formulir cuti...</p>;

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak Formulir
        </button>
      </div>

      <LeaveFormDocument data={data} quota={quota} />
    </div>
  );
}
