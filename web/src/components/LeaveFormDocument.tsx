import { durationUnitLabel, formatDate, formatMasaKerja, gradeLabel } from '../format';
import type * as api from '../api';

export interface LeaveFormDocumentProps {
  data: api.LeaveRequestDetail;
  quota: api.Quota | null;
}

export function LeaveFormDocument({ data, quota }: LeaveFormDocumentProps) {
  const raw = data as Record<string, unknown>;
  const unit = durationUnitLabel(data.duration_unit);
  const leaveType = data.leave_type;

  // Resolusi kuota catatan cuti: utamakan catatan admin saat ACC (legacy_quota_*),
  // bila kosong gunakan sisa kuota yang tersedia dari engine quota.
  const quotaN = raw.legacy_quota_n !== undefined && raw.legacy_quota_n !== null
    ? String(raw.legacy_quota_n)
    : quota ? String(quota.available.n) : '-';
  const noteN = (raw.legacy_note_n as string) || '-';

  const quotaN1 = raw.legacy_quota_n1 !== undefined && raw.legacy_quota_n1 !== null
    ? String(raw.legacy_quota_n1)
    : quota ? String(quota.available.n1) : '-';
  const noteN1 = (raw.legacy_note_n1 as string) || '-';

  const quotaN2 = raw.legacy_quota_n2 !== undefined && raw.legacy_quota_n2 !== null
    ? String(raw.legacy_quota_n2)
    : quota ? String(quota.available.n2) : '-';
  const noteN2 = (raw.legacy_note_n2 as string) || '-';

  const address = (raw.address as string) || '-';
  const phone = (raw.phone as string) || '-';
  const approver1Name = (raw.approver_1_name as string) || '...........................................';
  const approver1Nip = (raw.approver_1_nip as string) || '...........................................';
  const approver1Position = (raw.approver_1_position as string) || 'Atasan Langsung';
  const approver2Name = (raw.approver_2_name as string) || '...........................................';
  const approver2Nip = (raw.approver_2_nip as string) || '...........................................';
  const approver2Position = (raw.approver_2_position as string) || 'Pejabat Yang Berwenang Memberikan Cuti';
  const submittedAt = (raw.submitted_at as string | null | undefined) ?? (raw.created_at as string | null | undefined);

  const isChecked = (typeMatch: string) =>
    leaveType.toLowerCase().includes(typeMatch.toLowerCase()) ? '✓' : '';

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 6mm 10mm 4mm 10mm;
        }
        @media print {
          html, body {
            width: 100% !important;
            height: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print-toolbar {
            display: none !important;
          }
          .print-wrap {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
          }
          .print-sheet {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 100% !important;
            font-size: 8pt !important;
            line-height: 1.15 !important;
          }
          .print-table {
            margin-bottom: 2.5px !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-table th,
          .print-table td {
            padding: 1.5px 3.5px !important;
            font-size: 8pt !important;
            line-height: 1.15 !important;
          }
          .print-qr-img {
            width: 36px !important;
            height: 36px !important;
          }
          .print-qr-box {
            height: 38px !important;
            margin: 1px auto !important;
          }
        }
        .print-table {
          width: 100% !important;
          border-collapse: collapse !important;
          border: 1px solid #000 !important;
        }
        .print-table th,
        .print-table td {
          border: 1px solid #000 !important;
          padding: 2px 4px !important;
        }
        .print-table tr:last-child td,
        .print-table tbody tr:last-child td,
        .print-table tr:last-child th,
        .print-table tbody tr:last-child th {
          border-bottom: 1px solid #000 !important;
        }
      `}</style>

      <div className="print-sheet" style={{ fontSize: '8.5pt', lineHeight: 1.2 }}>
        <div style={{ textAlign: 'right', fontSize: '7.5pt', marginBottom: '4px', lineHeight: 1.15 }}>
          <strong>ANAK LAMPIRAN 1.b</strong><br />
          PERATURAN BADAN KEPEGAWAIAN NEGARA REPUBLIK INDONESIA<br />
          NOMOR 24 TAHUN 2017<br />
          TENTANG TATA CARA PEMBERIAN CUTI PEGAWAI NEGERI SIPIL<br /><br />
          Sleman, {formatDate(submittedAt)}<br />
          Kepada :<br />
          Yth. Kepala Kantor Kementerian Agama Kab. Sleman<br />
          Di Sleman
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '10pt', margin: '2px 0 4px', fontWeight: 'bold' }}>
          <span style={{ textDecoration: 'underline', textUnderlineOffset: '2px' }}>
            FORMULIR PERMINTAAN DAN PEMBERIAN CUTI
          </span>
        </h2>

        {/* I. DATA PEGAWAI */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={4}><strong>I. DATA PEGAWAI</strong></th>
            </tr>
            <tr>
              <td style={{ width: '15%' }}><strong>Nama</strong></td>
              <td style={{ width: '35%' }}>{data.name}</td>
              <td style={{ width: '15%' }}><strong>NIP</strong></td>
              <td style={{ width: '35%' }}>{data.nip ?? '-'}</td>
            </tr>
            <tr>
              <td><strong>Jabatan</strong></td>
              <td>{(raw.position as string) || '-'}</td>
              <td><strong>Masa Kerja</strong></td>
              <td>
                {formatMasaKerja(
                  (raw.service_years as string) ||
                  (raw.masa_kerja as string) ||
                  (quota ? quota.eligibility.months_worked : null),
                  data.nip,
                  data.start_date,
                )}
              </td>
            </tr>
            <tr>
              <td><strong>Unit Kerja</strong></td>
              <td>{(raw.organization_name as string) || '-'}</td>
              <td><strong>Pangkat / Gol</strong></td>
              <td>{gradeLabel(data.grade as string | null | undefined)}</td>
            </tr>
          </tbody>
        </table>

        {/* II. JENIS CUTI YANG DIAMBIL */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={4}><strong>II. JENIS CUTI YANG DIAMBIL**</strong></th>
            </tr>
            <tr>
              <td style={{ width: '35%' }}>1. Cuti Tahunan</td>
              <td style={{ width: '15%', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('tahunan')}</td>
              <td style={{ width: '35%' }}>2. Cuti Besar</td>
              <td style={{ width: '15%', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('besar')}</td>
            </tr>
            <tr>
              <td>3. Cuti Sakit</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{isChecked('sakit')}</td>
              <td>4. Cuti Melahirkan</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{isChecked('melahirkan')}</td>
            </tr>
            <tr>
              <td>5. Cuti Karena Alasan Penting</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{isChecked('penting')}</td>
              <td>6. Cuti di Luar Tanggungan Negara</td>
              <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{isChecked('luar')}</td>
            </tr>
          </tbody>
        </table>

        {/* III. ALASAN CUTI */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th><strong>III. ALASAN CUTI</strong></th>
            </tr>
            <tr>
              <td>{data.reason || '-'}</td>
            </tr>
          </tbody>
        </table>

        {/* IV. LAMANYA CUTI */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={6}><strong>IV. LAMANYA CUTI</strong></th>
            </tr>
            <tr>
              <td style={{ width: '15%' }}><strong>Selama</strong></td>
              <td style={{ width: '25%' }}>{data.duration} {unit}</td>
              <td style={{ width: '15%' }}><strong>Mulai Tanggal</strong></td>
              <td style={{ width: '20%' }}>{formatDate(data.start_date)}</td>
              <td style={{ width: '5%', textAlign: 'center' }}>s/d</td>
              <td style={{ width: '20%' }}>{formatDate(data.end_date)}</td>
            </tr>
          </tbody>
        </table>

        {/* V. CATATAN CUTI */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={5}><strong>V. CATATAN CUTI***</strong></th>
            </tr>
            <tr style={{ textAlign: 'center', fontWeight: 'bold', background: '#fafafa' }}>
              <td colSpan={3} style={{ width: '45%' }}>1. CUTI TAHUNAN</td>
              <td style={{ width: '35%' }}>2. CUTI BESAR</td>
              <td style={{ width: '20%', textAlign: 'center' }}>-</td>
            </tr>
            <tr style={{ textAlign: 'center' }}>
              <td style={{ width: '15%' }}>Tahun</td>
              <td style={{ width: '15%' }}>Sisa</td>
              <td style={{ width: '15%' }}>Keterangan</td>
              <td style={{ textAlign: 'left' }}>3. CUTI SAKIT</td>
              <td>-</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>N-2</td>
              <td style={{ textAlign: 'center' }}>{quotaN2}</td>
              <td style={{ textAlign: 'center' }}>{noteN2}</td>
              <td>4. CUTI MELAHIRKAN</td>
              <td style={{ textAlign: 'center' }}>-</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>N-1</td>
              <td style={{ textAlign: 'center' }}>{quotaN1}</td>
              <td style={{ textAlign: 'center' }}>{noteN1}</td>
              <td>5. CUTI KARENA ALASAN PENTING</td>
              <td style={{ textAlign: 'center' }}>-</td>
            </tr>
            <tr>
              <td style={{ textAlign: 'center' }}>N</td>
              <td style={{ textAlign: 'center' }}>{quotaN}</td>
              <td style={{ textAlign: 'center' }}>{noteN}</td>
              <td>6. CUTI DI LUAR TANGGUNGAN NEGARA</td>
              <td style={{ textAlign: 'center' }}>-</td>
            </tr>
          </tbody>
        </table>

        {/* VI. ALAMAT SELAMA MENJALANKAN CUTI */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={2}><strong>VI. ALAMAT SELAMA MENJALANKAN CUTI</strong></th>
            </tr>
            <tr>
              <td style={{ width: '55%', verticalAlign: 'top', padding: '4px 6px' }}>
                {address}<br />
                <strong>Telp:</strong> {phone}
              </td>
              <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top', padding: '4px' }}>
                Hormat saya,
                <div className="print-qr-box" style={{ margin: '1px auto', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {data.verify_code ? (
                    <img className="print-qr-img" src={`/api/v1/verify/${data.verify_code}/qr`} alt="QR Verifikasi" style={{ width: '36px', height: '36px', display: 'block' }} />
                  ) : (
                    <div style={{ height: '30px' }} />
                  )}
                </div>
                <u><strong>{data.name}</strong></u><br />
                NIP. {data.nip ?? '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* VII. PERTIMBANGAN ATASAN LANGSUNG */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={4}><strong>VII. PERTIMBANGAN ATASAN LANGSUNG**</strong></th>
            </tr>
            <tr style={{ textAlign: 'center', fontSize: '8pt' }}>
              <td style={{ width: '25%' }}>DISETUJUI</td>
              <td style={{ width: '25%' }}>PERUBAHAN</td>
              <td style={{ width: '25%' }}>DITANGGUHKAN</td>
              <td style={{ width: '25%' }}>TIDAK DISETUJUI</td>
            </tr>
            <tr style={{ height: '18px', textAlign: 'center', fontWeight: 'bold' }}>
              <td>{raw.approver_1_status === 'accepted' || raw.admin_decision === 'accepted' ? '✓' : ''}</td>
              <td></td>
              <td></td>
              <td>{raw.approver_1_status === 'rejected' ? '✓' : ''}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ verticalAlign: 'top', padding: '4px 6px', fontSize: '8pt', color: '#555' }}>
                Catatan / Keterangan:
              </td>
              <td colSpan={2} style={{ textAlign: 'center', verticalAlign: 'top', padding: '4px' }}>
                {approver1Position}
                <div className="print-qr-box" style={{ margin: '1px auto', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {data.verify_code ? (
                    <img className="print-qr-img" src={`/api/v1/verify/${data.verify_code}/qr`} alt="QR Verifikasi" style={{ width: '36px', height: '36px', display: 'block' }} />
                  ) : (
                    <div style={{ height: '30px' }} />
                  )}
                </div>
                <u><strong>{approver1Name}</strong></u><br />
                NIP. {approver1Nip}
              </td>
            </tr>
          </tbody>
        </table>

        {/* VIII. KEPUTUSAN PEJABAT BERWENANG */}
        <table className="print-table" style={{ fontSize: '8.5pt', marginBottom: '3px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={4}><strong>VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI**</strong></th>
            </tr>
            <tr style={{ textAlign: 'center', fontSize: '8pt' }}>
              <td style={{ width: '25%' }}>DISETUJUI</td>
              <td style={{ width: '25%' }}>PERUBAHAN</td>
              <td style={{ width: '25%' }}>DITANGGUHKAN</td>
              <td style={{ width: '25%' }}>TIDAK DISETUJUI</td>
            </tr>
            <tr style={{ height: '18px', textAlign: 'center', fontWeight: 'bold' }}>
              <td>{raw.approver_2_status === 'accepted' || raw.admin_decision === 'accepted' ? '✓' : ''}</td>
              <td></td>
              <td></td>
              <td>{raw.approver_2_status === 'rejected' ? '✓' : ''}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ verticalAlign: 'top', padding: '4px 6px', fontSize: '8pt', color: '#555' }}>
                Catatan / Keterangan:
              </td>
              <td colSpan={2} style={{ textAlign: 'center', verticalAlign: 'top', padding: '4px' }}>
                {approver2Position}
                <div className="print-qr-box" style={{ margin: '1px auto', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {data.verify_code ? (
                    <img className="print-qr-img" src={`/api/v1/verify/${data.verify_code}/qr`} alt="QR Verifikasi" style={{ width: '36px', height: '36px', display: 'block' }} />
                  ) : (
                    <div style={{ height: '30px' }} />
                  )}
                </div>
                <u><strong>{approver2Name}</strong></u><br />
                NIP. {approver2Nip}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '6.5pt', color: '#444', marginTop: '2px', lineHeight: 1.15 }}>
          <em>
            Catatan:<br />
            * Coret yang tidak perlu | ** Pilih salah satu dengan memberi tanda centang (✓)<br />
            *** Diisi oleh pejabat yang menangani bidang kepegawaian sebelum PNS mengajukan cuti<br />
            **** Diberi tanda centang dan alasannya | N = Cuti tahun berjalan | N-1 = Sisa cuti 1 tahun sebelumnya | N-2 = Sisa cuti 2 tahun sebelumnya
          </em>
        </div>

        <div style={{ marginTop: '2px', color: '#334155', fontStyle: 'italic', borderTop: '0.5px dashed #cbd5e1', paddingTop: '2px', fontSize: '6.5pt' }}>
          Permohonan ini sudah dilakukan dan diverifikasi melalui aplikasi SEDAKEP oleh Kantor Kementerian Agama Kab. Sleman.
        </div>
      </div>
    </>
  );
}

