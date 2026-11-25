import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDate } from '../format';
import * as api from '../api';

/**
 * Tampilan cetak lembar disposisi — cerminan 100% presisi FPDF legacy `disposisi/cetak_dispo.php`.
 * Berisi kop resmi, kotak judul LEMBAR DISPOSISI, grid data surat masuk 2 kolom,
 * verifikasi Ka. Subbag TU, disposisi pimpinan, dan pelaksana.
 */

export function DispositionPrint() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<api.IncomingLetterDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

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

  const handleDownloadPdf = async () => {
    if (!data) return;
    setDownloading(true);
    try {
      const res = await api.generateDispositionPdf(data.id);
      window.open(res.url, '_blank');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membuat PDF lembar disposisi');
    } finally {
      setDownloading(false);
    }
  };

  if (error) return <p className="err">{error}</p>;
  if (!data) return <p className="sub">Memuat data disposisi...</p>;

  const instance = data.instance ?? {};
  const firstDispo = data.dispositions?.[0];
  const firstFinal = data.finals?.[0];

  return (
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak Lembar
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
          fontSize: '10.5pt',
          lineHeight: '1.4',
          fontFamily: 'Arial, Helvetica, sans-serif',
          color: '#000',
        }}
      >
        {/* Kop Surat Kemenag Sleman */}
        <header
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

        {/* Kotak LEMBAR DISPOSISI */}
        <div
          style={{
            border: '1.5px solid #000',
            textAlign: 'center',
            padding: '8px',
            fontSize: '12pt',
            fontWeight: 'bold',
            marginBottom: '12px',
          }}
        >
          LEMBAR DISPOSISI
        </div>

        {/* Tabel Metadata Surat Masuk (Grid Bergaris Sesuai Legacy) */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '14px',
            border: '1px solid #000',
            fontSize: '9.5pt',
          }}
        >
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', width: '20%', padding: '6px', fontWeight: 'bold' }}>
                Nomor Surat
              </td>
              <td style={{ border: '1px solid #000', width: '30%', padding: '6px' }}>
                : {data.letter_number || '-'}
              </td>
              <td style={{ border: '1px solid #000', width: '20%', padding: '6px', fontWeight: 'bold' }}>
                Nomor Agenda
              </td>
              <td style={{ border: '1px solid #000', width: '30%', padding: '6px' }}>
                : {data.agenda_number || '-'}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>
                Tanggal Surat
              </td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>
                : {formatDate(data.letter_date)}
              </td>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>
                Nomor Tiket
              </td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>
                : {data.ticket_number || '-'}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>
                Tanggal Diterima
              </td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>
                : {formatDate(data.received_date)}
              </td>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>
                Kode Surat
              </td>
              <td style={{ border: '1px solid #000', padding: '6px' }}>
                : {data.classification_code || '-'}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold' }}>
                Asal Surat
              </td>
              <td colSpan={3} style={{ border: '1px solid #000', padding: '6px' }}>
                : {data.origin || '-'}
              </td>
            </tr>
            <tr>
              <td style={{ border: '1px solid #000', padding: '6px', fontWeight: 'bold', verticalAlign: 'top' }}>
                Perihal
              </td>
              <td colSpan={3} style={{ border: '1px solid #000', padding: '6px', minHeight: '40px', verticalAlign: 'top' }}>
                : {data.content || '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Status Verifikasi Ka. Subbag TU */}
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '14px',
            border: '1px solid #000',
            fontSize: '9.5pt',
          }}
        >
          <tbody>
            <tr>
              <td style={{ border: '1px solid #000', width: '65%', padding: '8px', fontWeight: 'bold' }}>
                Telah Diperiksa Oleh Ka. Subbag TU
              </td>
              <td style={{ border: '1px solid #000', width: '35%', padding: '6px', textAlign: 'center' }}>
                Paraf : <span style={{ fontStyle: 'italic', color: '#006600' }}>[Terverifikasi Sistem]</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Kotak Disposisi Pimpinan */}
        <div
          style={{
            border: '1px solid #000',
            padding: '10px',
            marginBottom: '14px',
            fontSize: '9.5pt',
          }}
        >
          <div style={{ display: 'flex', marginBottom: '6px' }}>
            <div style={{ width: '130px', fontWeight: 'bold' }}>Disposisi kepada</div>
            <div>: {firstDispo?.target_name || '-'}</div>
          </div>
          <div style={{ display: 'flex', marginBottom: '6px' }}>
            <div style={{ width: '130px', fontWeight: 'bold' }}>Isi disposisi</div>
            <div>: {firstDispo?.instruction || '-'}</div>
          </div>
          <div style={{ display: 'flex', marginBottom: '6px' }}>
            <div style={{ width: '130px', fontWeight: 'bold' }}>Catatan</div>
            <div>: {firstDispo?.notes || '-'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: '130px', fontWeight: 'bold' }}>Paraf Pimpinan</div>
            <div>: {firstDispo?.target_name ? <span style={{ color: '#006600' }}>[Paraf Elektronik Tersemat]</span> : '-'}</div>
          </div>
        </div>

        {/* Kotak Pelaksana Disposisi (jika ada) */}
        {firstFinal ? (
          <div
            style={{
              border: '1px solid #000',
              padding: '10px',
              marginBottom: '18px',
              fontSize: '9.5pt',
            }}
          >
            <div style={{ display: 'flex', marginBottom: '6px' }}>
              <div style={{ width: '130px', fontWeight: 'bold' }}>Pelaksana disposisi</div>
              <div>: {firstFinal.name || '-'}</div>
            </div>
            <div style={{ display: 'flex', marginBottom: '6px' }}>
              <div style={{ width: '130px', fontWeight: 'bold' }}>Instruksi</div>
              <div>: {firstFinal.instruction || '-'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '130px', fontWeight: 'bold' }}>Paraf Pelaksana</div>
              <div>: <span style={{ color: '#006600' }}>[Paraf Elektronik Tersemat]</span></div>
            </div>
          </div>
        ) : null}

        {/* Petugas Disposisi (Kanan Bawah) */}
        <div style={{ float: 'right', width: '220px', textAlign: 'center', marginTop: '10px' }}>
          <div>Petugas Disposisi,</div>
          <div style={{ height: '55px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '8pt', color: '#888' }}>[TTE SEDAKEP]</span>
          </div>
          <div style={{ fontWeight: 'bold' }}>Petugas PTSP</div>
        </div>
        <div style={{ clear: 'both' }}></div>
      </div>
    </div>
  );
}
