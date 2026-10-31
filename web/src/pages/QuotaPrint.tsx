import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/**
 * Tampilan cetak buku cuti satu pegawai.
 *
 * Cerminan `cetak_buku_cuti.php`: kop instansi, identitas pegawai, dan tabel
 * projection saldo per tahun. Di luar Layout, dicetak lewat `window.print()`.
 */

export function QuotaPrint() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const target = userId && userId !== 'me' ? Number(userId) : 'me';

  const [data, setData] = useState<api.QuotaBookPrint | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getQuotaBookPrint(target)
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat buku cuti');
      });
    return () => {
      alive = false;
    };
  }, [target]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="sub">Memuat...</p>;

  const instance = data.instance ?? {};

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak
        </button>
      </div>

      <div className="print-sheet">
        <header className="print-kop">
          <div className="print-instansi">
            <strong>{instance.name ?? ''}</strong>
            <div>{instance.address ?? ''}</div>
          </div>
        </header>

        <h1 className="print-title">BUKU CUTI</h1>

        <dl className="kv">
          <dt>Nama</dt>
          <dd>{data.user.name}</dd>
          <dt>NIP</dt>
          <dd>{data.user.nip ?? '-'}</dd>
          <dt>Unit kerja</dt>
          <dd>{data.user.unit_name ?? '-'}</dd>
        </dl>

        {data.stored.length === 0 ? (
          <p className="print-line">Belum ada projection saldo cuti.</p>
        ) : (
          <table className="print-table">
            <thead>
              <tr>
                <th>Tahun</th>
                <th>Sisa N</th>
                <th>Sisa N-1</th>
                <th>Sisa N-2</th>
                <th>Total</th>
                <th>Terpesan</th>
                <th>Dibangun</th>
              </tr>
            </thead>
            <tbody>
              {data.stored.map((row) => (
                <tr key={row.year}>
                  <td>{row.year}</td>
                  <td>{row.remaining_n}</td>
                  <td>{row.remaining_n1}</td>
                  <td>{row.remaining_n2}</td>
                  <td>{row.total_remaining}</td>
                  <td>{row.reserved_days}</td>
                  <td>{row.computed_at ? formatDate(row.computed_at) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
