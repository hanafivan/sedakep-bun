import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/**
 * Tampilan cetak surat tugas.
 *
 * Meniru `cetak_surtug.php`: kop instansi, nomor, tubuh surat, daftar pegawai,
 * keterangan, tembusan, dan penanda tangan. Halaman ini sengaja berada di luar
 * Layout (tanpa menu) dan dicetak lewat `window.print()`. PDF sisi server →
 * MinIO menyusul di Fase 13.
 */

type PrintData = api.AssignmentLetterDetail;

export function AssignmentPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<PrintData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .getAssignmentLetter(Number(id))
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : 'Gagal memuat surat tugas');
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="sub">Memuat...</p>;

  const isDraft = data.decision !== 'accepted' || !data.letter_number;
  const isTerlampir =
    data.members.length === 1 && data.members[0].name.trim().toLowerCase() === 'terlampir';

  const timeText =
    !data.time_start || data.time_start.trim() === '-'
      ? 'Menyesuaikan jadwal masing-masing.'
      : `${data.time_start}${data.time_end ? ` s/d ${data.time_end}` : ''}`;

  const scheduleText =
    data.start_date === data.end_date
      ? `${data.day_start ? `${data.day_start}, ` : ''}${formatDate(data.start_date)}`
      : `${data.day_start ?? ''} s/d ${data.day_end ?? ''}, ${formatDate(data.start_date)} s/d ${formatDate(data.end_date)}`;

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak {isDraft ? '(Draf)' : ''}
        </button>
      </div>

      <div
        className="print-sheet"
        style={{ paddingBottom: data.footnote ? `${data.footnote}mm` : undefined, position: 'relative' }}
      >
        {isDraft ? (
          <img
            src="/draft.png"
            alt="Draft Watermark"
            style={{
              position: 'absolute',
              top: '25%',
              left: '25%',
              width: '50%',
              opacity: 0.2,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        ) : null}

        <header
          className="print-kop"
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '3px double #000',
            paddingBottom: '8px',
            marginBottom: '16px',
          }}
        >
          <img
            src="/logo_kemenag.jpg"
            alt="Logo Kemenag"
            style={{ width: '68px', height: '65px', objectFit: 'contain' }}
          />
          <div style={{ flex: 1, textAlign: 'center', paddingLeft: '8px' }}>
            <div style={{ fontSize: '13pt', fontWeight: 'bold', letterSpacing: '0.3px' }}>
              KEMENTERIAN AGAMA REPUBLIK INDONESIA
            </div>
            <div style={{ fontSize: '11.5pt', fontWeight: 'bold' }}>
              KANTOR KEMENTERIAN AGAMA KABUPATEN SLEMAN
            </div>
            <div style={{ fontSize: '9pt' }}>
              {data.instance?.address || 'Jalan Dr. Radjimin, Sleman, Daerah Istimewa Yogyakarta 55511'}
            </div>
            <div style={{ fontSize: '9pt' }}>Telpon (0274) 868314, Faksimile (0274) 869675</div>
            <div style={{ fontSize: '9pt' }}>
              Situs: {data.instance?.website || 'sleman.kemenag.go.id'}
            </div>
          </div>
        </header>

        <h1 className="print-title">SURAT TUGAS</h1>
        <p className="print-number">
          {data.number_display ? `NOMOR: ${data.number_display}` : 'NOMOR: DRAFT'}
        </p>

        <div className="print-body">
          <div style={{ display: 'grid', gridTemplateColumns: '100px 14px 1fr', margin: '6px 0', textAlign: 'justify' }}>
            <span>Menimbang</span>
            <span>:</span>
            <span>{data.consideration ?? '-'}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '100px 14px 1fr', margin: '6px 0', textAlign: 'justify' }}>
            <span>Dasar</span>
            <span>:</span>
            <span>{data.legal_basis ?? '-'}</span>
          </div>

          <p className="print-center" style={{ margin: '14px 0 10px', fontWeight: 700 }}>
            Memberi Tugas
          </p>

          {isTerlampir ? (
            <div style={{ display: 'grid', gridTemplateColumns: '100px 14px 1fr', margin: '6px 0' }}>
              <span>Kepada</span>
              <span>:</span>
              <span>Daftar nama sebagaimana terlampir.</span>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '100px 14px 1fr', margin: '4px 0 6px' }}>
                <span>Kepada</span>
                <span>:</span>
                <span />
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px', textAlign: 'center' }}>No</th>
                    <th>Nama / NIP / Gol</th>
                    <th>Jabatan / Tempat Tugas</th>
                  </tr>
                </thead>
                <tbody>
                  {data.members.map((member, index) => (
                    <tr key={member.id}>
                      <td style={{ textAlign: 'center' }}>{index + 1}</td>
                      <td>
                        <strong>{member.name}</strong>
                        {member.nip ? (
                          <div style={{ fontSize: '10pt', color: '#333' }}>
                            NIP. {member.nip}
                            {member.grade ? `, ${member.grade}` : ''}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div>{member.position ?? '-'}</div>
                        {member.organization_name ? (
                          <div style={{ fontSize: '10pt', color: '#333' }}>{member.organization_name}</div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '100px 14px 1fr', margin: '12px 0 6px', textAlign: 'justify' }}>
            <span>Untuk</span>
            <span>:</span>
            <div>
              {data.content ?? '-'}, yang akan dilaksanakan pada:
              <div style={{ marginTop: '6px', marginLeft: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '70px 12px 1fr', gap: '2px', lineHeight: 1.45 }}>
                  <span>Hari/Tgl</span>
                  <span>:</span>
                  <span>{scheduleText}</span>
                  <span>Waktu</span>
                  <span>:</span>
                  <span>{timeText}</span>
                  <span>Tempat</span>
                  <span>:</span>
                  <span>{data.place ?? '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {data.notes.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '100px 14px 1fr', margin: '8px 0' }}>
              <span>Keterangan</span>
              <span>:</span>
              <div>
                <ol style={{ margin: 0, paddingLeft: '18px' }}>
                  {data.notes.map((note) => (
                    <li key={note.id}>{note.note}</li>
                  ))}
                </ol>
              </div>
            </div>
          ) : null}
        </div>

        <div className="print-sign">
          <div>
            {data.place ? `${data.place}, ` : ''}
            {formatDate(data.printed_at ?? data.created_at)}
          </div>
          <div>{data.signer_position ?? ''}</div>
          <div className="print-sign-space" />
          <div>
            <strong>{data.signer_name ?? ''}</strong>
          </div>
        </div>

        {data.copies.length > 0 ? (
          <div className="print-copies" style={{ marginTop: '16px' }}>
            <strong>Tembusan:</strong>
            <ol style={{ margin: '4px 0 0', paddingLeft: '18px' }}>
              {data.copies.map((copy) => (
                <li key={copy.id}>{copy.copy_to}</li>
              ))}
            </ol>
          </div>
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
