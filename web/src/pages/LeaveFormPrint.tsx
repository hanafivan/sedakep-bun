import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { durationUnitLabel, formatDate, gradeLabel } from '../format';
import * as api from '../api';

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
    <div className="print-wrap">
      <div className="print-toolbar">
        <button className="button secondary small" type="button" onClick={() => navigate(-1)}>
          Kembali
        </button>
        <button className="button small" type="button" onClick={() => window.print()}>
          Cetak Formulir
        </button>
      </div>

      <div className="print-sheet" style={{ fontSize: '10pt', lineHeight: 1.35 }}>
        <div style={{ textAlign: 'right', fontSize: '9pt', marginBottom: '12px', lineHeight: 1.3 }}>
          <strong>ANAK LAMPIRAN 1.b</strong><br />
          PERATURAN BADAN KEPEGAWAIAN NEGARA REPUBLIK INDONESIA<br />
          NOMOR 24 TAHUN 2017<br />
          TENTANG TATA CARA PEMBERIAN CUTI PEGAWAI NEGERI SIPIL<br /><br />
          Sleman, {formatDate(submittedAt)}<br />
          Kepada :<br />
          Yth. Kepala Kantor Kementerian Agama Kab. Sleman<br />
          Di Sleman
        </div>

        <h2 style={{ textAlign: 'center', fontSize: '11.5pt', margin: '8px 0 10px', fontWeight: 'bold' }}>
          <span style={{ textDecoration: 'underline', textUnderlineOffset: '3px' }}>
            FORMULIR PERMINTAAN DAN PEMBERIAN CUTI
          </span>
        </h2>

        {/* I. DATA PEGAWAI */}
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
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
              <td>{(raw.masa_kerja as string) || (quota ? `${quota.eligibility.months_worked} Bulan` : '-')}</td>
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
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
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
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
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
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
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
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={5}><strong>V. CATATAN CUTI***</strong></th>
            </tr>
            <tr>
              <td colSpan={3} style={{ width: '50%' }}><strong>1. CUTI TAHUNAN</strong></td>
              <td style={{ width: '35%' }}><strong>2. CUTI BESAR</strong></td>
              <td style={{ width: '15%', textAlign: 'center' }}>-</td>
            </tr>
            <tr>
              <td style={{ width: '15%' }}>Tahun</td>
              <td style={{ width: '10%' }}>Sisa</td>
              <td style={{ width: '25%' }}>Keterangan</td>
              <td><strong>3. CUTI SAKIT</strong></td>
              <td style={{ textAlign: 'center' }}>-</td>
            </tr>
            <tr>
              <td>N-2</td>
              <td style={{ textAlign: 'center' }}>{quotaN2}</td>
              <td>{noteN2}</td>
              <td><strong>4. CUTI MELAHIRKAN</strong></td>
              <td style={{ textAlign: 'center' }}>-</td>
            </tr>
            <tr>
              <td>N-1</td>
              <td style={{ textAlign: 'center' }}>{quotaN1}</td>
              <td>{noteN1}</td>
              <td><strong>5. CUTI KARENA ALASAN PENTING</strong></td>
              <td style={{ textAlign: 'center' }}>-</td>
            </tr>
            <tr>
              <td>N</td>
              <td style={{ textAlign: 'center' }}>{quotaN}</td>
              <td>{noteN}</td>
              <td><strong>6. CUTI DI LUAR TANGGUNGAN NEGARA</strong></td>
              <td style={{ textAlign: 'center' }}>-</td>
            </tr>
          </tbody>
        </table>

        {/* VI. ALAMAT SELAMA MENJALANKAN CUTI */}
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={2}><strong>VI. ALAMAT SELAMA MENJALANKAN CUTI</strong></th>
            </tr>
            <tr>
              <td style={{ width: '55%', verticalAlign: 'top', padding: '8px' }}>
                {address}<br />
                <strong>Telp:</strong> {phone}
              </td>
              <td style={{ width: '45%', textAlign: 'center', verticalAlign: 'top', padding: '12px 6px' }}>
                Hormat saya,<br /><br /><br /><br />
                <u><strong>{data.name}</strong></u><br />
                NIP. {data.nip ?? '-'}
              </td>
            </tr>
          </tbody>
        </table>

        {/* VII. PERTIMBANGAN ATASAN LANGSUNG */}
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={4}><strong>VII. PERTIMBANGAN ATASAN LANGSUNG**</strong></th>
            </tr>
            <tr style={{ textAlign: 'center' }}>
              <td style={{ width: '25%' }}>DISETUJUI</td>
              <td style={{ width: '25%' }}>PERUBAHAN****</td>
              <td style={{ width: '25%' }}>DITANGGUHKAN****</td>
              <td style={{ width: '25%' }}>TIDAK DISETUJUI****</td>
            </tr>
            <tr style={{ height: '24px', textAlign: 'center', fontWeight: 'bold' }}>
              <td>{data.approver_1_status === 'accepted' ? '✓' : ''}</td>
              <td></td>
              <td></td>
              <td>{data.approver_1_status === 'rejected' ? '✓' : ''}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ verticalAlign: 'top', padding: '8px 10px', fontSize: '9pt', color: '#555' }}>
                Catatan / Keterangan:
              </td>
              <td colSpan={2} style={{ textAlign: 'center', verticalAlign: 'top', padding: '10px 6px' }}>
                {approver1Position}<br /><br /><br /><br />
                <u><strong>{approver1Name}</strong></u><br />
                NIP. {approver1Nip}
              </td>
            </tr>
          </tbody>
        </table>

        {/* VIII. KEPUTUSAN PEJABAT YANG BERWENANG */}
        <table className="print-table" style={{ fontSize: '9.5pt', marginBottom: '8px' }}>
          <tbody>
            <tr style={{ background: '#f5f5f5' }}>
              <th colSpan={4}><strong>VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI**</strong></th>
            </tr>
            <tr style={{ textAlign: 'center' }}>
              <td style={{ width: '25%' }}>DISETUJUI</td>
              <td style={{ width: '25%' }}>PERUBAHAN****</td>
              <td style={{ width: '25%' }}>DITANGGUHKAN****</td>
              <td style={{ width: '25%' }}>TIDAK DISETUJUI****</td>
            </tr>
            <tr style={{ height: '24px', textAlign: 'center', fontWeight: 'bold' }}>
              <td>{data.approver_2_status === 'accepted' ? '✓' : ''}</td>
              <td></td>
              <td></td>
              <td>{data.approver_2_status === 'rejected' ? '✓' : ''}</td>
            </tr>
            <tr>
              <td colSpan={2} style={{ verticalAlign: 'top', padding: '8px 10px', fontSize: '9pt', color: '#555' }}>
                Catatan / Keterangan:
              </td>
              <td colSpan={2} style={{ textAlign: 'center', verticalAlign: 'top', padding: '10px 6px' }}>
                {approver2Position}<br /><br /><br /><br />
                <u><strong>{approver2Name}</strong></u><br />
                NIP. {approver2Nip}
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '8pt', color: '#444', marginTop: '6px', lineHeight: 1.3 }}>
          <em>
            Catatan:<br />
            * Coret yang tidak perlu | ** Pilih salah satu dengan memberi tanda centang (✓)<br />
            *** Diisi oleh pejabat yang menangani bidang kepegawaian sebelum PNS mengajukan cuti<br />
            **** Diberi tanda centang dan alasannya | N = Cuti tahun berjalan | N-1 = Sisa cuti 1 tahun sebelumnya | N-2 = Sisa cuti 2 tahun sebelumnya
          </em>
        </div>

        {data.verify_code ? (
          <div className="print-qr" style={{ marginTop: '12px' }}>
            <img src={`/api/v1/verify/${data.verify_code}/qr`} alt="QR verifikasi" style={{ width: '64px', height: '64px' }} />
            <div>Pindai untuk verifikasi keabsahan formulir</div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

