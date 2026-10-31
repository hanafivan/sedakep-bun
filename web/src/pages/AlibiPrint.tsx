import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/**
 * Tampilan cetak alibi — cerminan `cetak_alibi.php`. Di luar Layout, dicetak
 * lewat `window.print()`.
 */

export function AlibiPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<api.AlibiDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getAlibiRequest(Number(id))
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat alibi');
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

        <h1 className="print-title">SURAT KETERANGAN ALIBI</h1>

        <p className="print-line">Yang bertanda tangan di bawah ini menerangkan bahwa:</p>
        <dl className="kv">
          <dt>Nama</dt>
          <dd>{data.name}</dd>
          <dt>NIP</dt>
          <dd>{data.nip ?? '-'}</dd>
          <dt>Jabatan</dt>
          <dd>{data.position ?? '-'}</dd>
          <dt>Unit kerja</dt>
          <dd>{data.organization_name ?? '-'}</dd>
        </dl>

        <p className="print-line">
          pada tanggal <strong>{formatDate(data.alibi_date)}</strong>
          {data.time_start ? ` pukul ${data.time_start}` : ''}
          {data.time_end ? ` s.d. ${data.time_end}` : ''} tercatat{' '}
          <strong>{data.alibi_type ?? '-'}</strong>
          {data.day_count ? ` (${data.day_count} hari)` : ''} dengan alasan:{' '}
          {data.reason ?? '-'}.
        </p>

        <p className="print-line">
          Demikian surat keterangan ini dibuat untuk dipergunakan sebagaimana mestinya.
        </p>

        <div className="print-sign">
          <div>
            {instance.address ?? ''}
          </div>
          <div>{data.approver_2_position ?? instance.head_name ?? ''}</div>
          <div className="print-sign-space" />
          <div>
            <strong>{data.approver_2_name ?? instance.head_name ?? ''}</strong>
          </div>
        </div>

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
