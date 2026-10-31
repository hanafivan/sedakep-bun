import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { durationUnitLabel, formatDate, gradeLabel } from '../format';
import * as api from '../api';

/**
 * Tampilan cetak surat keterangan cuti.
 *
 * Cerminan `cetak_sk.php`/`cetak_sk_pdf.php`: kop instansi, nomor SK, data
 * pegawai, masa cuti, dan penanda tangan. Di luar Layout, dicetak lewat
 * `window.print()`. PDF sisi server → MinIO menyusul di Fase 13.
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
  if (!data) return <p className="sub">Memuat...</p>;

  const letter = data.letters.find((item) => item.letter_type === 'suket') ?? data.letters[0] ?? null;
  const instance = data.instance ?? {};
  const unit = durationUnitLabel(data.duration_unit);

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
        {!letter || !letter.number ? (
          <div className="print-draft" aria-hidden="true">
            DRAFT
          </div>
        ) : null}
        <header className="print-kop">
          <div className="print-instansi">
            <strong>{instance.name ?? ''}</strong>
            <div>{instance.address ?? ''}</div>
            {instance.website ? <div>{instance.website}</div> : null}
          </div>
        </header>

        <h1 className="print-title">SURAT KETERANGAN CUTI</h1>
        <p className="print-number">NOMOR: {letter?.number ?? '-'}</p>

        {!letter ? (
          <p className="print-line">
            Surat keterangan belum diterbitkan untuk permohonan ini.
          </p>
        ) : (
          <>
              <p className="print-line">
                Yang bertanda tangan di bawah ini menerangkan bahwa:
              </p>
              <p className="print-line">
                1. Diberikan <strong>{data.leave_type}</strong> kepada Pegawai Negeri Sipil:
              </p>
              <dl className="kv">
              <dt>Nama</dt>
              <dd>{data.name}</dd>
              <dt>NIP</dt>
              <dd>{data.nip ?? '-'}</dd>
              <dt>Pangkat/Gol. Ruang</dt>
              <dd>{gradeLabel(data.grade as string | null | undefined)}</dd>
              <dt>Jabatan</dt>
              <dd>{(data as Record<string, unknown>).position as string ?? '-'}</dd>
              <dt>Unit kerja</dt>
              <dd>{(data as Record<string, unknown>).organization_name as string ?? '-'}</dd>
            </dl>

              <p className="print-line">
                Selama: <strong>{data.duration} {unit} Kerja,</strong> terhitung mulai tanggal:{' '}
                <strong>{formatDate(data.start_date)}</strong> sampai dengan tanggal:{' '}
                <strong>{formatDate(data.end_date)}</strong> dengan ketentuan sebagai berikut:
              </p>

              <p className="print-line">
                a. Sebelum menjalankan cuti wajib menyerahkan pekerjaannya kepada atasan langsungnya atau pejabat lain yang ditunjuk.
              </p>
              <p className="print-line">
                b. Setelah selesai menjalankan cuti wajib melaporkan diri kepada atasan langsungnya dan bekerja kembali.
              </p>

              <p className="print-line">
                2. Demikian Surat Keterangan Cuti ini dibuat untuk dapat dipergunakan sebagaimana mestinya.
              </p>

            <div className="print-sign">
              <div>
                {instance.name ? `${instance.address ?? ''}` : ''}
              </div>
              <div>{letter.official_position ?? instance.head_name ?? ''}</div>
              <div className="print-sign-space" />
              <div>
                <u><strong>{letter.official_name ?? instance.head_name ?? ''}</strong></u>
              </div>
            </div>
          </>
        )}

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
