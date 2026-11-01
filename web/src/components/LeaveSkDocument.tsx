import { durationUnitLabel, formatDate, gradeLabel } from '../format';
import type * as api from '../api';

export interface LeaveSkDocumentProps {
  data: api.LeaveRequestDetail;
}

export function LeaveSkDocument({ data }: LeaveSkDocumentProps) {
  const letter = data.letters.find((item) => item.letter_type === 'suket') ?? data.letters[0] ?? null;
  const instance = data.instance ?? {};
  const unit = durationUnitLabel(data.duration_unit);
  const raw = data as Record<string, unknown>;

  return (
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
            <dd>{(raw.position as string) ?? '-'}</dd>
            <dt>Unit kerja</dt>
            <dd>{(raw.organization_name as string) ?? '-'}</dd>
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
  );
}

