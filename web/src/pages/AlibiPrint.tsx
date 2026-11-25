import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/**
 * Tampilan cetak alibi — cerminan 100% presisi FPDF legacy `alibi/cetak_alibi.php`.
 * Dilengkapi kop resmi Kemenag Sleman, 5 baris checkbox, blok tanda tangan ganda,
 * QR verifikasi digital, dan tombol Unduh PDF resmi F4.
 */

const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

export function AlibiPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<api.AlibiDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const res = await api.generateAlibiPdf(data.id);
      window.open(res.url, '_blank');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membuat PDF resmi');
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="sub">Memuat data alibi...</p>;

  const isApproved = data.status === 'approved';
  const instance = data.instance ?? {};

  let dayName = '-';
  if (data.alibi_date) {
    const d = new Date(data.alibi_date);
    if (!isNaN(d.getTime())) dayName = DAYS_ID[d.getDay()] ?? '-';
  }

  const tStr = String(data.alibi_type || '').toLowerCase();
  const is1 = tStr === '1' || tStr.includes('tidak hadir');
  const is2 = tStr === '2' || tStr.includes('terlambat');
  const is3 = tStr === '3' || tStr.includes('pulang');
  const is4 = tStr === '4' || tStr.includes('tidak berada');
  const is5 = tStr === '5' || tStr.includes('pagi');
  const is6 = tStr === '6' || tStr.includes('sore');
  const is7 = tStr === '7' || (!is1 && !is2 && !is3 && !is4 && !is5 && !is6);

  const unitText =
    data.organization_name && data.organization_name !== 'Kantor Kementerian Agama Kab. Sleman'
      ? `${data.organization_name}\nKantor Kementerian Agama Kab. Sleman`
      : 'Kantor Kementerian Agama Kab. Sleman';

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak {isApproved ? '' : '(Draf)'}
        </button>
        <button
          className="button secondary small"
          type="button"
          disabled={downloading}
          onClick={handleDownloadPdf}
        >
          {downloading ? 'Memproses...' : 'Unduh PDF Resmi (F4)'}
        </button>
      </div>

      <div
        className="print-sheet"
        style={{
          width: '210mm',
          minHeight: '330mm',
          padding: '20mm 20mm 20mm 25mm',
          boxSizing: 'border-box',
          position: 'relative',
          backgroundColor: '#fff',
          fontSize: '11pt',
          lineHeight: '1.45',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#000',
        }}
      >
        {!isApproved ? (
          <img
            src="/draft.png"
            alt="Watermark Draf"
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

        {/* Kop Surat Kemenag Sleman */}
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            borderBottom: '3px double #000',
            paddingBottom: '8px',
            marginBottom: '20px',
          }}
        >
          <img
            src="/logo_kemenag.jpg"
            alt="Logo Kemenag"
            style={{ width: '68px', height: '65px', objectFit: 'contain' }}
          />
          <div style={{ flex: 1, textAlign: 'center', lineHeight: '1.2' }}>
            <div style={{ fontSize: '13pt', fontWeight: 'bold' }}>
              KEMENTERIAN AGAMA REPUBLIK INDONESIA
            </div>
            <div style={{ fontSize: '11pt', fontWeight: 'bold' }}>
              KANTOR KEMENTERIAN AGAMA KABUPATEN SLEMAN
            </div>
            <div style={{ fontSize: '8pt', marginTop: '2px' }}>
              {instance.address || 'Jalan Dr. Radjimin, Sleman, Daerah Istimewa Yogyakarta 55511'}
            </div>
            <div style={{ fontSize: '8pt' }}>
              Telpon (0274) 868314, Faksimile (0274) 869675
            </div>
            <div style={{ fontSize: '8pt' }}>Situs: sleman.kemenag.go.id</div>
          </div>
        </header>

        {/* Judul Surat */}
        <div style={{ textAlign: 'center', marginBottom: '18px' }}>
          <div style={{ fontSize: '12pt', fontWeight: 'bold' }}>
            SURAT KETERANGAN / PEMBERITAHUAN / IZIN
          </div>
        </div>

        {/* Identitas Pemohon */}
        <p style={{ margin: '0 0 10px 0' }}>Yang bertanda tangan di bawah ini :</p>
        <table style={{ width: '100%', marginBottom: '14px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '30px' }}></td>
              <td style={{ width: '150px', padding: '2px 0' }}>Nama</td>
              <td style={{ width: '15px' }}>:</td>
              <td style={{ fontWeight: 'bold' }}>{data.name}</td>
            </tr>
            <tr>
              <td></td>
              <td style={{ padding: '2px 0' }}>NIP</td>
              <td>:</td>
              <td>{data.nip || '-'}</td>
            </tr>
            <tr>
              <td></td>
              <td style={{ padding: '2px 0' }}>Pangkat/Gol. Ruang</td>
              <td>:</td>
              <td>{data.grade || '-'}</td>
            </tr>
            <tr>
              <td></td>
              <td style={{ padding: '2px 0' }}>Jabatan</td>
              <td>:</td>
              <td>{data.position || '-'}</td>
            </tr>
            <tr>
              <td></td>
              <td style={{ verticalAlign: 'top', padding: '2px 0' }}>Satuan Organisasi</td>
              <td style={{ verticalAlign: 'top' }}>:</td>
              <td style={{ whiteSpace: 'pre-line' }}>{unitText}</td>
            </tr>
          </tbody>
        </table>

        {/* Waktu Pelaksanaan */}
        <p style={{ margin: '0 0 10px 0' }}>Dengan ini mohon izin/memberitahukan bahwa pada :</p>
        <table style={{ width: '100%', marginBottom: '14px', borderCollapse: 'collapse' }}>
          <tbody>
            <tr>
              <td style={{ width: '30px' }}></td>
              <td style={{ width: '150px', padding: '2px 0' }}>Hari</td>
              <td style={{ width: '15px' }}>:</td>
              <td>{dayName}</td>
            </tr>
            <tr>
              <td></td>
              <td style={{ padding: '2px 0' }}>Tanggal</td>
              <td>:</td>
              <td>{formatDate(data.alibi_date)}</td>
            </tr>
          </tbody>
        </table>

        {/* Pilihan Checklist Alibi */}
        <div style={{ marginLeft: '30px', marginBottom: '16px' }}>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>{is1 ? '[ V ]' : '[   ]'}</span> &nbsp; tidak hadir
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>{is2 ? '[ V ]' : '[   ]'}</span> &nbsp; terlambat masuk kerja
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>{is3 ? '[ V ]' : '[   ]'}</span> &nbsp; pulang sebelum waktunya
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>{is4 ? '[ V ]' : '[   ]'}</span> &nbsp; tidak berada di tempat kerja
          </div>
          <div style={{ marginBottom: '4px' }}>
            <span style={{ fontWeight: 'bold' }}>{is5 || is6 || is7 ? '[ V ]' : '[   ]'}</span> &nbsp;{' '}
            {`tidak mengisi daftar hadir ${is5 ? '(pagi)' : is6 ? '(sore)' : ''}`.trim()}
          </div>
        </div>

        {/* Alasan & Penutup */}
        <p style={{ margin: '0 0 10px 0', textAlign: 'justify' }}>
          Dikarenakan {data.reason || '-'} dari pukul {data.time_start || '07:30'} WIB s.d.{' '}
          {data.time_end || '16:00'} WIB.
        </p>
        <p style={{ margin: '0 0 30px 0', textAlign: 'justify' }}>
          Demikian keterangan ini saya buat untuk dapat dipergunakan sebagaimana mestinya.
        </p>

        {/* Tanda Tangan */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ width: '48%', textAlign: 'left' }}>
            <div style={{ height: '22px' }}></div>
            <div>{data.approver_1_position || 'Atasan Langsung'},</div>
            <div style={{ height: '70px', display: 'flex', alignItems: 'center' }}>
              {isApproved && data.verify_code ? (
                <img
                  src={`/api/v1/verify/${data.verify_code}/qr`}
                  alt="QR Verifikasi"
                  style={{ width: '55px', height: '55px' }}
                />
              ) : null}
            </div>
            <div style={{ fontWeight: 'bold' }}>{data.approver_1_name || '-'}</div>
            <div style={{ fontSize: '9.5pt' }}>NIP. {data.approver_1_nip || '-'}</div>
          </div>

          <div style={{ width: '48%', textAlign: 'left', paddingLeft: '20px' }}>
            <div>Sleman, {formatDate(data.printed_at || data.created_at)}</div>
            <div>{data.position || 'Pemohon'},</div>
            <div style={{ height: '70px', display: 'flex', alignItems: 'center' }}>
              {isApproved && data.verify_code ? (
                <img
                  src={`/api/v1/verify/${data.verify_code}/qr`}
                  alt="QR Verifikasi"
                  style={{ width: '55px', height: '55px' }}
                />
              ) : null}
            </div>
            <div style={{ fontWeight: 'bold' }}>{data.name}</div>
            <div style={{ fontSize: '9.5pt' }}>NIP. {data.nip || '-'}</div>
          </div>
        </div>

        {/* Atasan 2 (jika ada) */}
        {data.approver_2_name && data.approver_2_name !== '-' ? (
          <div style={{ marginLeft: '120px', marginBottom: '20px' }}>
            <div>Mengetahui,</div>
            <div>{data.approver_2_position || 'Kepala'}</div>
            <div style={{ height: '65px', display: 'flex', alignItems: 'center' }}>
              {isApproved && data.verify_code ? (
                <img
                  src={`/api/v1/verify/${data.verify_code}/qr`}
                  alt="QR Verifikasi"
                  style={{ width: '55px', height: '55px' }}
                />
              ) : null}
            </div>
            <div style={{ fontWeight: 'bold' }}>{data.approver_2_name}</div>
            <div style={{ fontSize: '9.5pt' }}>NIP. {data.approver_2_nip || '-'}</div>
          </div>
        ) : null}

        {/* Footnote Elektronik */}
        {isApproved ? (
          <div
            style={{
              position: 'absolute',
              bottom: '15mm',
              left: '25mm',
              right: '20mm',
              borderTop: '0.8px solid #666',
              paddingTop: '6px',
              fontSize: '8pt',
              color: '#555',
            }}
          >
            <div>Ditandatangani secara elektronik melalui aplikasi SEDAKEP</div>
            {data.verify_code ? (
              <div>https://sleman.kemenag.go.id/sedakep/verify/{data.verify_code}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
