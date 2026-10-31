import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../api';
import { durationUnitLabel, formatDate, gradeLabel } from '../format';

/**
 * Halaman verifikasi dokumen QR publik (tanpa login).
 *
 * Menampilkan halaman Formulir Permohonan Cuti resmi dengan popup modal
 * "Dokumen Valid & Terverifikasi" saat pertama kali dibuka.
 */
export function Verify() {
  const { code } = useParams();
  const [state, setState] = useState<'loading' | 'ok' | 'bad'>('loading');
  const [data, setData] = useState<api.VerifyResult | null>(null);
  const [showModal, setShowModal] = useState<boolean>(true);

  useEffect(() => {
    if (!code) {
      setState('bad');
      return;
    }
    let alive = true;
    api
      .verifyDocument(code)
      .then((value) => {
        if (!alive) return;
        setData(value);
        setState('ok');
        setShowModal(true);
      })
      .catch(() => {
        if (alive) setState('bad');
      });
    return () => {
      alive = false;
    };
  }, [code]);

  if (state === 'loading') {
    return (
      <div className="centered" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 440, textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px' }}>Memverifikasi Dokumen...</h2>
          <p style={{ color: '#64748b', fontSize: '13.5px', margin: 0 }}>
            Memeriksa keaslian tanda tangan digital dan keabsahan QR Code pada sistem SEDAKEP.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'bad' || !data) {
    return (
      <div className="centered" style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card" style={{ maxWidth: 480, textAlign: 'center', padding: '36px 28px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#fee2e2',
              color: '#dc2626',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              fontWeight: 900,
              margin: '0 auto 16px',
            }}
          >
            ✕
          </div>
          <h1 style={{ fontSize: '19px', margin: '0 0 8px', color: '#991b1b' }}>
            Dokumen Tidak Valid / Tidak Ditemukan
          </h1>
          <p style={{ fontSize: '13.5px', color: '#64748b', lineHeight: 1.5, margin: '0 0 20px' }}>
            Kode verifikasi QR tidak sah atau dokumen tidak terdaftar pada sistem kepegawaian SEDAKEP. Pastikan QR Code dipindai utuh langsung dari dokumen asli.
          </p>
          <code style={{ display: 'block', background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', color: '#475569', wordBreak: 'break-all', marginBottom: '20px' }}>
            {code}
          </code>
          <Link to="/" className="button secondary small">
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const detail = data.leave_detail;
  const instance = data.instance;

  // Helper jika leave_detail tersedia
  const raw = (detail || {}) as Record<string, unknown>;
  const leaveType = (raw.leave_type as string) || (data.leave_type as string) || '';
  const isChecked = (typeMatch: string) =>
    leaveType.toLowerCase().includes(typeMatch.toLowerCase()) ? '✓' : '';

  const unit = durationUnitLabel((raw.duration_unit as string) || 'day');
  const submittedAt = (raw.submitted_at as string) || (raw.created_at as string) || (raw.start_date as string);
  const startDate = formatDate(raw.start_date as string);
  const endDate = formatDate(raw.end_date as string);

  const quotaN = raw.legacy_quota_n !== null && raw.legacy_quota_n !== undefined ? String(raw.legacy_quota_n) : '-';
  const quotaN1 = raw.legacy_quota_n1 !== null && raw.legacy_quota_n1 !== undefined ? String(raw.legacy_quota_n1) : '-';
  const quotaN2 = raw.legacy_quota_n2 !== null && raw.legacy_quota_n2 !== undefined ? String(raw.legacy_quota_n2) : '-';
  const noteN = (raw.legacy_note_n as string) || '-';
  const noteN1 = (raw.legacy_note_n1 as string) || '-';
  const noteN2 = (raw.legacy_note_n2 as string) || '-';

  const approver1Name = (raw.approver_1_name as string) || 'H. Sangaji, S.Ag';
  const approver1Nip = (raw.approver_1_nip as string) || '-';
  const approver1Pos = (raw.approver_1_position as string) || 'Atasan Langsung';

  const approver2Name = (raw.approver_2_name as string) || (instance?.head_name ?? 'H. Sidik Pramono, S.Ag., M.Si.');
  const approver2Nip = (raw.approver_2_nip as string) || (instance?.head_nip ?? '197005081998031002');
  const approver2Pos = (raw.approver_2_position as string) || 'Kepala Kantor Kementerian Agama Kab. Sleman';

  const statusLabel =
    raw.status === 'approved' || raw.admin_decision === 'accepted' || data.status === 'approved'
      ? 'DISETUJUI (Sah & Tercatat Resmi)'
      : raw.status === 'rejected'
      ? 'Ditolak'
      : raw.status === 'cancelled'
      ? 'Dibatalkan'
      : 'Dalam Proses Pemeriksaan';

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', color: '#0f172a' }}>
      {/* Topbar Verifikasi Sticky */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: '#065f46',
          color: '#ffffff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600 }}>
          <span style={{ fontSize: '16px' }}>✓</span>
          <span>Dokumen Sah & Terverifikasi · SEDAKEP</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="button small"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', color: '#ffffff', padding: '4px 12px', fontSize: '12px' }}
            onClick={() => setShowModal(true)}
          >
            Tampilkan Info Verifikasi
          </button>
          <button
            type="button"
            className="button small"
            style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)', color: '#ffffff', padding: '4px 12px', fontSize: '12px' }}
            onClick={() => window.print()}
          >
            Cetak Formulir
          </button>
        </div>
      </header>

      {/* POPUP MODAL DOKUMEN VALID */}
      {showModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '520px',
              borderRadius: '14px',
              boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.25)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div style={{ background: 'linear-gradient(135deg, #065f46 0%, #0E6B4C 100%)', color: '#ffffff', padding: '24px 20px 20px', textAlign: 'center' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  background: '#ffffff',
                  color: '#0E6B4C',
                  borderRadius: '50%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 900,
                  marginBottom: '12px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.15)',
                }}
              >
                ✓
              </div>
              <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 800, letterSpacing: '-0.01em' }}>
                DOKUMEN VALID & TERVERIFIKASI
              </h2>
              <div style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#d1fae5' }}>
                Sistem Informasi Kepegawaian & Pelayanan Cuti SEDAKEP
              </div>
            </div>

            {/* Body Modal */}
            <div style={{ padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Status Keabsahan</span>
                <span style={{ background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0', fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                  ✓ Asli & Terdaftar
                </span>
              </div>

              <div style={{ fontSize: '13px', lineHeight: 1.5, marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Dokumen</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{data.document || 'Formulir Permohonan Cuti'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Nama Pegawai</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(raw.name || data.name || '-')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>NIP</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(raw.nip || '-')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Jenis Cuti</span>
                  <span style={{ fontWeight: 600, color: '#0f172a' }}>{leaveType}</span>
                </div>
                {raw.duration ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#64748b', fontWeight: 500 }}>Durasi & Periode</span>
                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{String(raw.duration)} {unit} ({startDate} s.d. {endDate})</span>
                  </div>
                ) : null}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ color: '#64748b', fontWeight: 500 }}>Keputusan</span>
                  <span style={{ fontWeight: 700, color: '#166534' }}>{statusLabel}</span>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div style={{ padding: '14px 22px 20px', background: '#fafbfc', borderTop: '1px solid #f1f5f9' }}>
              <button
                type="button"
                className="button primary"
                style={{ width: '100%', height: '42px', fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                onClick={() => setShowModal(false)}
              >
                ✓ Tutup & Lihat Halaman Formulir
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* HALAMAN FORMULIR LENGKAP */}
      <div className="print-wrap" style={{ maxWidth: '820px', margin: '24px auto 48px', padding: '0 16px' }}>
        <div className="print-sheet" style={{ background: '#ffffff', padding: '36px 40px', borderRadius: '8px', boxShadow: '0 4px 14px rgba(0,0,0,0.06)', fontSize: '10pt', lineHeight: 1.35, color: '#000000' }}>
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
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th colSpan={4} style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>I. DATA PEGAWAI</strong></th>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%' }}><strong>Nama</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '35%' }}>{String(raw.name || data.name || '-')}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%' }}><strong>NIP</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '35%' }}>{String(raw.nip || '-')}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>Jabatan</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{String(raw.position || '-')}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>Masa Kerja</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{String(raw.service_years || '-')}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>Unit Kerja</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{String(raw.organization_name || '-')}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>Pangkat / Gol</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{gradeLabel(raw.grade as string | null | undefined)}</td>
              </tr>
            </tbody>
          </table>

          {/* II. JENIS CUTI YANG DIAMBIL */}
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th colSpan={4} style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>II. JENIS CUTI YANG DIAMBIL**</strong></th>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '35%' }}>1. Cuti Tahunan</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('tahunan')}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '35%' }}>2. Cuti Besar</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('besar')}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>3. Cuti Sakit</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('sakit')}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>4. Cuti Melahirkan</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('melahirkan')}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>5. Cuti Karena Alasan Penting</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('penting')}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>6. Cuti di Luar Tanggungan Negara</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isChecked('luar')}</td>
              </tr>
            </tbody>
          </table>

          {/* III. ALASAN CUTI */}
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>III. ALASAN CUTI</strong></th>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{String(raw.reason || '-')}</td>
              </tr>
            </tbody>
          </table>

          {/* IV. LAMANYA CUTI */}
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th colSpan={6} style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>IV. LAMANYA CUTI</strong></th>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%' }}><strong>Selama</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%' }}>{String(raw.duration || '-')} {unit}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%' }}><strong>Mulai Tanggal</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '20%' }}>{startDate}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '5%', textAlign: 'center' }}>s/d</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '20%' }}>{endDate}</td>
              </tr>
            </tbody>
          </table>

          {/* V. CATATAN CUTI */}
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th colSpan={5} style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>V. CATATAN CUTI***</strong></th>
              </tr>
              <tr>
                <td colSpan={3} style={{ border: '1px solid #333', padding: '4px 6px', width: '50%' }}><strong>1. CUTI TAHUNAN</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '35%' }}><strong>2. CUTI BESAR</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%', textAlign: 'center' }}>-</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '15%' }}>Tahun</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '10%' }}>Sisa</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%' }}>Keterangan</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>3. CUTI SAKIT</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center' }}>-</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>N-2</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center' }}>{quotaN2}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{noteN2}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>4. CUTI MELAHIRKAN</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center' }}>-</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>N-1</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center' }}>{quotaN1}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{noteN1}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>5. CUTI KARENA ALASAN PENTING</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center' }}>-</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>N</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center' }}>{quotaN}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}>{noteN}</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>6. CUTI DI LUAR TANGGUNGAN NEGARA</strong></td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', textAlign: 'center' }}>-</td>
              </tr>
            </tbody>
          </table>

          {/* VI. ALAMAT SELAMA MENJALANKAN CUTI */}
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th colSpan={2} style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>VI. ALAMAT SELAMA MENJALANKAN CUTI</strong></th>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '8px', width: '55%', verticalAlign: 'top' }}>
                  {String(raw.address || '-')}<br />
                  <strong>Telp:</strong> {String(raw.phone || '-')}
                </td>
                <td style={{ border: '1px solid #333', width: '45%', textAlign: 'center', verticalAlign: 'top', padding: '12px 6px' }}>
                  Hormat saya,<br /><br /><br /><br />
                  <u><strong>{String(raw.name || data.name || '-')}</strong></u><br />
                  NIP. {String(raw.nip || '-')}
                </td>
              </tr>
            </tbody>
          </table>

          {/* VII. PERTIMBANGAN ATASAN LANGSUNG */}
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th colSpan={4} style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>VII. PERTIMBANGAN ATASAN LANGSUNG**</strong></th>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>DISETUJUI</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>PERUBAHAN</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>DITANGGUHKAN</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>TIDAK DISETUJUI</td>
              </tr>
              <tr style={{ height: '24px', textAlign: 'center', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #333' }}>{raw.approver_1_status === 'accepted' || raw.admin_decision === 'accepted' ? '✓' : ''}</td>
                <td style={{ border: '1px solid #333' }}></td>
                <td style={{ border: '1px solid #333' }}></td>
                <td style={{ border: '1px solid #333' }}>{raw.approver_1_status === 'rejected' ? '✓' : ''}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: '1px solid #333', verticalAlign: 'top', padding: '8px 10px', fontSize: '9pt', color: '#555' }}>
                  Catatan / Keterangan:
                </td>
                <td colSpan={2} style={{ border: '1px solid #333', textAlign: 'center', verticalAlign: 'top', padding: '10px 6px' }}>
                  {approver1Pos}<br /><br /><br /><br />
                  <u><strong>{approver1Name}</strong></u><br />
                  NIP. {approver1Nip}
                </td>
              </tr>
            </tbody>
          </table>

          {/* VIII. KEPUTUSAN PEJABAT BERWENANG */}
          <table className="print-table" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px', fontSize: '9.5pt' }}>
            <tbody>
              <tr style={{ background: '#f5f5f5' }}>
                <th colSpan={4} style={{ border: '1px solid #333', padding: '4px 6px' }}><strong>VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI**</strong></th>
              </tr>
              <tr>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>DISETUJUI</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>PERUBAHAN</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>DITANGGUHKAN</td>
                <td style={{ border: '1px solid #333', padding: '4px 6px', width: '25%', textAlign: 'center' }}>TIDAK DISETUJUI</td>
              </tr>
              <tr style={{ height: '24px', textAlign: 'center', fontWeight: 'bold' }}>
                <td style={{ border: '1px solid #333' }}>{raw.approver_2_status === 'accepted' || raw.admin_decision === 'accepted' ? '✓' : ''}</td>
                <td style={{ border: '1px solid #333' }}></td>
                <td style={{ border: '1px solid #333' }}></td>
                <td style={{ border: '1px solid #333' }}>{raw.approver_2_status === 'rejected' ? '✓' : ''}</td>
              </tr>
              <tr>
                <td colSpan={2} style={{ border: '1px solid #333', verticalAlign: 'top', padding: '8px 10px', fontSize: '9pt', color: '#555' }}>
                  Catatan / Keterangan:
                </td>
                <td colSpan={2} style={{ border: '1px solid #333', textAlign: 'center', verticalAlign: 'top', padding: '10px 6px' }}>
                  {approver2Pos}<br /><br /><br /><br />
                  <u><strong>{approver2Name}</strong></u><br />
                  NIP. {approver2Nip}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ fontSize: '8pt', color: '#555', marginTop: '6px', lineHeight: 1.3 }}>
            <em>
              Catatan:<br />
              * Coret yang tidak perlu | ** Pilih salah satu dengan memberi tanda centang (✓)<br />
              *** Diisi oleh pejabat yang menangani bidang kepegawaian sebelum PNS mengajukan cuti<br />
              **** Diberi tanda centang dan alasannya | N = Cuti tahun berjalan | N-1 = Sisa cuti 1 tahun sebelumnya | N-2 = Sisa cuti 2 tahun sebelumnya
            </em>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px', borderTop: '1px dashed #cbd5e1', paddingTop: '12px' }}>
            <img src={`/api/v1/verify/${code}/qr`} alt="QR Verifikasi" style={{ width: '64px', height: '64px', border: '1px solid #e2e8f0', borderRadius: '4px' }} />
            <div style={{ fontSize: '8pt', color: '#475569' }}>
              <strong>Tanda Tangan Elektronik & Verifikasi Keaslian</strong><br />
              Dokumen ini dinyatakan sah dan terdaftar resmi pada Sistem Informasi Kepegawaian SEDAKEP.<br />
              Kode Verifikasi: <code style={{ fontSize: '8pt', background: '#f1f5f9', padding: '1px 4px' }}>{code}</code>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
