import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/** Tampilan cetak lembar disposisi — cerminan `cetak_dispo.php`. */

export function DispositionPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<api.IncomingLetterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getIncomingLetter(Number(id))
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat surat masuk');
      });
    return () => {
      alive = false;
    };
  }, [id]);

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

        <h1 className="print-title">LEMBAR DISPOSISI</h1>

        <dl className="kv">
          <dt>Nomor agenda</dt>
          <dd>{data.agenda_number ?? '-'}</dd>
          <dt>Nomor surat</dt>
          <dd>{data.letter_number ?? '-'}</dd>
          <dt>Asal</dt>
          <dd>{data.origin ?? '-'}</dd>
          <dt>Tanggal surat</dt>
          <dd>{formatDate(data.letter_date)}</dd>
          <dt>Diterima</dt>
          <dd>{formatDate(data.received_date)}</dd>
          <dt>Klasifikasi</dt>
          <dd>{data.classification_code ?? '-'}</dd>
          <dt>Isi</dt>
          <dd>{data.content ?? '-'}</dd>
        </dl>

        <h2 className="print-line">Disposisi</h2>
        <table className="print-table">
          <thead>
            <tr>
              <th>No</th>
              <th>Tujuan</th>
              <th>Instruksi</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.dispositions.map((row, index) => (
              <tr key={row.id}>
                <td>{index + 1}</td>
                <td>{row.target_name ?? '-'}</td>
                <td>{row.instruction ?? '-'}</td>
                <td>{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {data.finals.length > 0 ? (
          <>
            <h2 className="print-line">Final</h2>
            <ul className="print-notes">
              {data.finals.map((row) => (
                <li key={row.id}>
                  {row.name ?? '-'} — {row.instruction ?? '-'}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {data.verify_code ? (
          <div className="print-qr">
            <img src={`/api/v1/verify/${data.verify_code}/qr`} alt="QR verifikasi" />
            <div>Pindai untuk verifikasi</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
