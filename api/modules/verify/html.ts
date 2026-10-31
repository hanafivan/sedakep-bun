/**
 * Template HTML publik untuk halaman verifikasi dokumen QR SEDAKEP.
 *
 * Menampilkan halaman Formulir Permohonan Cuti resmi dengan popup modal
 * "Dokumen Valid & Terverifikasi" saat pertama kali dibuka.
 */

const formatIdDate = (val?: string | null): string => {
  if (!val) return '-';
  const iso = String(val).slice(0, 10);
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

export const renderVerifiedLeaveFormHtml = (data: any, instance: any, code: string): string => {
  const isChecked = (match: string) =>
    (data.leave_type || '').toLowerCase().includes(match.toLowerCase()) ? '✓' : '';

  const unit = data.duration_unit === 'month' ? 'Bulan' : data.duration_unit === 'year' ? 'Tahun' : 'Hari';
  const submittedDate = formatIdDate(data.submitted_at || data.created_at || data.start_date);
  const startDate = formatIdDate(data.start_date);
  const endDate = formatIdDate(data.end_date);

  const quotaN = data.legacy_quota_n !== null && data.legacy_quota_n !== undefined ? String(data.legacy_quota_n) : '-';
  const quotaN1 = data.legacy_quota_n1 !== null && data.legacy_quota_n1 !== undefined ? String(data.legacy_quota_n1) : '-';
  const quotaN2 = data.legacy_quota_n2 !== null && data.legacy_quota_n2 !== undefined ? String(data.legacy_quota_n2) : '-';
  const noteN = data.legacy_note_n || '-';
  const noteN1 = data.legacy_note_n1 || '-';
  const noteN2 = data.legacy_note_n2 || '-';

  const approver1Name = data.approver_1_name || 'H. Sangaji, S.Ag';
  const approver1Nip = data.approver_1_nip || '-';
  const approver1Pos = data.approver_1_position || 'Atasan Langsung';

  const approver2Name = data.approver_2_name || (instance?.head_name ?? 'H. Sidik Pramono, S.Ag., M.Si.');
  const approver2Nip = data.approver_2_nip || (instance?.head_nip ?? '197005081998031002');
  const approver2Pos = data.approver_2_position || 'Kepala Kantor Kementerian Agama Kab. Sleman';

  const statusLabel =
    data.status === 'approved' || data.admin_decision === 'accepted'
      ? 'DISETUJUI (Sah & Tercatat Resmi)'
      : data.status === 'rejected'
      ? 'Ditolak'
      : data.status === 'cancelled'
      ? 'Dibatalkan'
      : 'Dalam Proses Pemeriksaan';

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Dokumen Cuti - SEDAKEP</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      line-height: 1.4;
    }

    /* Fixed Verification Header Banner */
    .verify-topbar {
      position: sticky;
      top: 0;
      z-index: 40;
      background: #065f46;
      color: #ffffff;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      flex-wrap: wrap;
      gap: 8px;
    }
    .verify-topbar-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13.5px;
      font-weight: 600;
    }
    .verify-topbar-actions {
      display: flex;
      gap: 8px;
    }
    .btn-topbar {
      background: rgba(255, 255, 255, 0.18);
      border: 1px solid rgba(255, 255, 255, 0.35);
      color: #ffffff;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-topbar:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* Print Paper Container */
    .print-wrap {
      max-width: 820px;
      margin: 24px auto 48px;
      padding: 0 16px;
    }
    .print-sheet {
      background: #ffffff;
      padding: 36px 40px;
      border-radius: 8px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.06);
      font-size: 10pt;
      line-height: 1.35;
      color: #000000;
    }

    .print-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
      font-size: 9.5pt;
    }
    .print-table th, .print-table td {
      border: 1px solid #000000;
      padding: 4px 6px;
      vertical-align: middle;
    }
    .print-table th {
      background-color: #f5f5f5;
      text-align: left;
    }

    /* Modal Backdrop & Popup */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      animation: fadeIn 0.2s ease-out;
    }
    .modal-card {
      background: #ffffff;
      width: 100%;
      max-width: 520px;
      border-radius: 14px;
      box-shadow: 0 20px 35px -5px rgba(0, 0, 0, 0.25);
      overflow: hidden;
      animation: slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .modal-header {
      background: linear-gradient(135deg, #065f46 0%, #0E6B4C 100%);
      color: #ffffff;
      padding: 24px 20px 20px;
      text-align: center;
      position: relative;
    }
    .modal-badge-icon {
      width: 52px;
      height: 52px;
      background: #ffffff;
      color: #0E6B4C;
      border-radius: 50%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 900;
      margin-bottom: 12px;
      box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    }
    .modal-title {
      margin: 0;
      font-size: 19px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .modal-sub {
      margin: 4px 0 0;
      font-size: 12.5px;
      color: #d1fae5;
    }
    .modal-body {
      padding: 20px 22px;
    }
    .valid-badge {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      border: 1px solid #bbf7d0;
      font-size: 11px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .kv-list {
      margin: 12px 0 0;
      font-size: 13px;
      line-height: 1.5;
    }
    .kv-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .kv-row:last-child {
      border-bottom: none;
    }
    .kv-label {
      color: #64748b;
      font-weight: 500;
    }
    .kv-val {
      font-weight: 600;
      color: #0f172a;
      text-align: right;
      max-width: 60%;
    }
    .modal-footer {
      padding: 14px 22px 20px;
      background: #fafbfc;
      border-top: 1px solid #f1f5f9;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .btn-view-form {
      background: #0E6B4C;
      color: #ffffff;
      border: none;
      padding: 12px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      width: 100%;
      text-align: center;
      transition: background 0.15s;
      box-shadow: 0 2px 6px rgba(14, 107, 76, 0.25);
    }
    .btn-view-form:hover {
      background: #065f46;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }

    @media print {
      .verify-topbar, .modal-backdrop {
        display: none !important;
      }
      body {
        background: #ffffff;
      }
      .print-wrap {
        margin: 0;
        padding: 0;
        max-width: none;
      }
      .print-sheet {
        padding: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>

  <!-- Topbar Banner -->
  <header class="verify-topbar">
    <div class="verify-topbar-title">
      <span style="font-size: 16px;">✓</span>
      <span>Dokumen Sah & Terverifikasi · SEDAKEP</span>
    </div>
    <div class="verify-topbar-actions">
      <button type="button" class="btn-topbar" onclick="openVerifyModal()">Tampilkan Info Verifikasi</button>
      <button type="button" class="btn-topbar" onclick="window.print()">Cetak Formulir</button>
    </div>
  </header>

  <!-- POPUP MODAL VERIFIKASI -->
  <div id="verifyModal" class="modal-backdrop" onclick="handleBackdropClick(event)">
    <div class="modal-card">
      <div class="modal-header">
        <div class="modal-badge-icon">✓</div>
        <h2 class="modal-title">DOKUMEN VALID & TERVERIFIKASI</h2>
        <div class="modal-sub">Sistem Informasi Kepegawaian & Pelayanan Cuti SEDAKEP</div>
      </div>
      <div class="modal-body">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 12px; color: #64748b; font-weight: 500;">Status Keabsahan</span>
          <span class="valid-badge">✓ Asli & Terdaftar</span>
        </div>
        <div class="kv-list">
          <div class="kv-row">
            <span class="kv-label">Dokumen</span>
            <span class="kv-val">Formulir Permohonan Cuti (BKN)</span>
          </div>
          <div class="kv-row">
            <span class="kv-label">Nama Pegawai</span>
            <span class="kv-val">${escapeHtml(data.name)}</span>
          </div>
          <div class="kv-row">
            <span class="kv-label">NIP</span>
            <span class="kv-val">${escapeHtml(data.nip || '-')}</span>
          </div>
          <div class="kv-row">
            <span class="kv-label">Jenis Cuti</span>
            <span class="kv-val">${escapeHtml(data.leave_type)}</span>
          </div>
          <div class="kv-row">
            <span class="kv-label">Durasi & Periode</span>
            <span class="kv-val">${data.duration} ${unit} (${startDate} s.d. ${endDate})</span>
          </div>
          <div class="kv-row">
            <span class="kv-label">Keputusan</span>
            <span class="kv-val" style="color: #166534;">${statusLabel}</span>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn-view-form" onclick="closeVerifyModal()">
          ✓ Tutup & Lihat Halaman Formulir
        </button>
      </div>
    </div>
  </div>

  <!-- HALAMAN FORMULIR LENGKAP -->
  <div class="print-wrap">
    <div class="print-sheet">
      <div style="text-align: right; font-size: 9pt; margin-bottom: 12px; line-height: 1.3;">
        <strong>ANAK LAMPIRAN 1.b</strong><br>
        PERATURAN BADAN KEPEGAWAIAN NEGARA REPUBLIK INDONESIA<br>
        NOMOR 24 TAHUN 2017<br>
        TENTANG TATA CARA PEMBERIAN CUTI PEGAWAI NEGERI SIPIL<br><br>
        Sleman, ${submittedDate}<br>
        Kepada :<br>
        Yth. Kepala Kantor Kementerian Agama Kab. Sleman<br>
        Di Sleman
      </div>

      <h2 style="text-align: center; font-size: 11.5pt; margin: 8px 0 10px; font-weight: bold;">
        <span style="text-decoration: underline; text-underline-offset: 3px;">
          FORMULIR PERMINTAAN DAN PEMBERIAN CUTI
        </span>
      </h2>

      <!-- I. DATA PEGAWAI -->
      <table class="print-table">
        <tbody>
          <tr>
            <th colspan="4"><strong>I. DATA PEGAWAI</strong></th>
          </tr>
          <tr>
            <td style="width: 15%;"><strong>Nama</strong></td>
            <td style="width: 35%;">${escapeHtml(data.name)}</td>
            <td style="width: 15%;"><strong>NIP</strong></td>
            <td style="width: 35%;">${escapeHtml(data.nip || '-')}</td>
          </tr>
          <tr>
            <td><strong>Jabatan</strong></td>
            <td>${escapeHtml(data.position || '-')}</td>
            <td><strong>Masa Kerja</strong></td>
            <td>${escapeHtml(data.service_years || '-')}</td>
          </tr>
          <tr>
            <td><strong>Unit Kerja</strong></td>
            <td>${escapeHtml(data.organization_name || '-')}</td>
            <td><strong>Pangkat / Gol</strong></td>
            <td>${escapeHtml(data.grade || '-')}</td>
          </tr>
        </tbody>
      </table>

      <!-- II. JENIS CUTI YANG DIAMBIL -->
      <table class="print-table">
        <tbody>
          <tr>
            <th colspan="4"><strong>II. JENIS CUTI YANG DIAMBIL**</strong></th>
          </tr>
          <tr>
            <td style="width: 35%;">1. Cuti Tahunan</td>
            <td style="width: 15%; text-align: center; font-weight: bold;">${isChecked('tahunan')}</td>
            <td style="width: 35%;">2. Cuti Besar</td>
            <td style="width: 15%; text-align: center; font-weight: bold;">${isChecked('besar')}</td>
          </tr>
          <tr>
            <td>3. Cuti Sakit</td>
            <td style="text-align: center; font-weight: bold;">${isChecked('sakit')}</td>
            <td>4. Cuti Melahirkan</td>
            <td style="text-align: center; font-weight: bold;">${isChecked('melahirkan')}</td>
          </tr>
          <tr>
            <td>5. Cuti Karena Alasan Penting</td>
            <td style="text-align: center; font-weight: bold;">${isChecked('penting')}</td>
            <td>6. Cuti di Luar Tanggungan Negara</td>
            <td style="text-align: center; font-weight: bold;">${isChecked('luar')}</td>
          </tr>
        </tbody>
      </table>

      <!-- III. ALASAN CUTI -->
      <table class="print-table">
        <tbody>
          <tr>
            <th><strong>III. ALASAN CUTI</strong></th>
          </tr>
          <tr>
            <td>${escapeHtml(data.reason || '-')}</td>
          </tr>
        </tbody>
      </table>

      <!-- IV. LAMANYA CUTI -->
      <table class="print-table">
        <tbody>
          <tr>
            <th colspan="6"><strong>IV. LAMANYA CUTI</strong></th>
          </tr>
          <tr>
            <td style="width: 15%;"><strong>Selama</strong></td>
            <td style="width: 25%;">${data.duration} ${unit}</td>
            <td style="width: 15%;"><strong>Mulai Tanggal</strong></td>
            <td style="width: 20%;">${startDate}</td>
            <td style="width: 5%; text-align: center;">s/d</td>
            <td style="width: 20%;">${endDate}</td>
          </tr>
        </tbody>
      </table>

      <!-- V. CATATAN CUTI -->
      <table class="print-table">
        <tbody>
          <tr>
            <th colspan="5"><strong>V. CATATAN CUTI***</strong></th>
          </tr>
          <tr>
            <td colspan="3" style="width: 50%;"><strong>1. CUTI TAHUNAN</strong></td>
            <td style="width: 35%;"><strong>2. CUTI BESAR</strong></td>
            <td style="width: 15%; text-align: center;">-</td>
          </tr>
          <tr>
            <td style="width: 15%;">Tahun</td>
            <td style="width: 10%;">Sisa</td>
            <td style="width: 25%;">Keterangan</td>
            <td><strong>3. CUTI SAKIT</strong></td>
            <td style="text-align: center;">-</td>
          </tr>
          <tr>
            <td>N-2</td>
            <td style="text-align: center;">${quotaN2}</td>
            <td>${escapeHtml(noteN2)}</td>
            <td><strong>4. CUTI MELAHIRKAN</strong></td>
            <td style="text-align: center;">-</td>
          </tr>
          <tr>
            <td>N-1</td>
            <td style="text-align: center;">${quotaN1}</td>
            <td>${escapeHtml(noteN1)}</td>
            <td><strong>5. CUTI KARENA ALASAN PENTING</strong></td>
            <td style="text-align: center;">-</td>
          </tr>
          <tr>
            <td>N</td>
            <td style="text-align: center;">${quotaN}</td>
            <td>${escapeHtml(noteN)}</td>
            <td><strong>6. CUTI DI LUAR TANGGUNGAN NEGARA</strong></td>
            <td style="text-align: center;">-</td>
          </tr>
        </tbody>
      </table>

      <!-- VI. ALAMAT SELAMA MENJALANKAN CUTI -->
      <table class="print-table">
        <tbody>
          <tr>
            <th colspan="2"><strong>VI. ALAMAT SELAMA MENJALANKAN CUTI</strong></th>
          </tr>
          <tr>
            <td style="width: 55%; vertical-align: top; padding: 8px;">
              ${escapeHtml(data.address || '-')}<br>
              <strong>Telp:</strong> ${escapeHtml(data.phone || '-')}
            </td>
            <td style="width: 45%; text-align: center; vertical-align: top; padding: 12px 6px;">
              Hormat saya,<br><br><br><br>
              <u><strong>${escapeHtml(data.name)}</strong></u><br>
              NIP. ${escapeHtml(data.nip || '-')}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- VII. PERTIMBANGAN ATASAN LANGSUNG -->
      <table class="print-table">
        <tbody>
          <tr>
            <th colspan="4"><strong>VII. PERTIMBANGAN ATASAN LANGSUNG**</strong></th>
          </tr>
          <tr>
            <td style="width: 25%; text-align: center;">DISETUJUI</td>
            <td style="width: 25%; text-align: center;">PERUBAHAN</td>
            <td style="width: 25%; text-align: center;">DITANGGUHKAN</td>
            <td style="width: 25%; text-align: center;">TIDAK DISETUJUI</td>
          </tr>
          <tr style="height: 24px; text-align: center; font-weight: bold;">
            <td>${data.approver_1_status === 'accepted' || data.admin_decision === 'accepted' ? '✓' : ''}</td>
            <td></td>
            <td></td>
            <td>${data.approver_1_status === 'rejected' ? '✓' : ''}</td>
          </tr>
          <tr>
            <td colspan="2" style="vertical-align: top; padding: 8px 10px; font-size: 9pt; color: #555;">
              Catatan / Keterangan:
            </td>
            <td colspan="2" style="text-align: center; vertical-align: top; padding: 10px 6px;">
              ${escapeHtml(approver1Pos)}<br><br><br><br>
              <u><strong>${escapeHtml(approver1Name)}</strong></u><br>
              NIP. ${escapeHtml(approver1Nip)}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- VIII. KEPUTUSAN PEJABAT BERWENANG -->
      <table class="print-table">
        <tbody>
          <tr>
            <th colspan="4"><strong>VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI**</strong></th>
          </tr>
          <tr>
            <td style="width: 25%; text-align: center;">DISETUJUI</td>
            <td style="width: 25%; text-align: center;">PERUBAHAN</td>
            <td style="width: 25%; text-align: center;">DITANGGUHKAN</td>
            <td style="width: 25%; text-align: center;">TIDAK DISETUJUI</td>
          </tr>
          <tr style="height: 24px; text-align: center; font-weight: bold;">
            <td>${data.approver_2_status === 'accepted' || data.admin_decision === 'accepted' ? '✓' : ''}</td>
            <td></td>
            <td></td>
            <td>${data.approver_2_status === 'rejected' ? '✓' : ''}</td>
          </tr>
          <tr>
            <td colspan="2" style="vertical-align: top; padding: 8px 10px; font-size: 9pt; color: #555;">
              Catatan / Keterangan:
            </td>
            <td colspan="2" style="text-align: center; vertical-align: top; padding: 10px 6px;">
              ${escapeHtml(approver2Pos)}<br><br><br><br>
              <u><strong>${escapeHtml(approver2Name)}</strong></u><br>
              NIP. ${escapeHtml(approver2Nip)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-size: 8pt; color: #555; margin-top: 6px; line-height: 1.3;">
        <em>
          Catatan:<br>
          * Coret yang tidak perlu | ** Pilih salah satu dengan memberi tanda centang (✓)<br>
          *** Diisi oleh pejabat yang menangani bidang kepegawaian sebelum PNS mengajukan cuti<br>
          **** Diberi tanda centang dan alasannya | N = Cuti tahun berjalan | N-1 = Sisa cuti 1 tahun sebelumnya | N-2 = Sisa cuti 2 tahun sebelumnya
        </em>
      </div>

      <div style="margin-top: 16px; display: flex; align-items: center; gap: 12px; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
        <img src="/api/v1/verify/${code}/qr" alt="QR Verifikasi" style="width: 64px; height: 64px; border: 1px solid #e2e8f0; border-radius: 4px;">
        <div style="font-size: 8pt; color: #475569;">
          <strong>Tanda Tangan Elektronik & Verifikasi Keaslian</strong><br>
          Dokumen ini dinyatakan sah dan terdaftar resmi pada Sistem Informasi Kepegawaian SEDAKEP.<br>
          Kode Verifikasi: <code style="font-size: 8pt; background: #f1f5f9; padding: 1px 4px;">${code}</code>
        </div>
      </div>

    </div>
  </div>

  <script>
    function closeVerifyModal() {
      var modal = document.getElementById('verifyModal');
      if (modal) {
        modal.style.display = 'none';
      }
    }
    function openVerifyModal() {
      var modal = document.getElementById('verifyModal');
      if (modal) {
        modal.style.display = 'flex';
      }
    }
    function handleBackdropClick(e) {
      if (e.target && e.target.id === 'verifyModal') {
        closeVerifyModal();
      }
    }
  </script>
</body>
</html>`;
};

export const renderInvalidCodeHtml = (code: string): string => {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dokumen Tidak Valid - SEDAKEP</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      color: #0f172a;
    }
    .card {
      background: #ffffff;
      padding: 36px 30px;
      border-radius: 12px;
      max-width: 460px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: #fee2e2;
      color: #dc2626;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 19px;
      margin: 0 0 8px;
      color: #991b1b;
    }
    p {
      font-size: 13.5px;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 20px;
    }
    code {
      display: block;
      margin: 12px 0;
      padding: 6px 10px;
      background: #f1f5f9;
      border-radius: 4px;
      font-size: 11px;
      color: #475569;
      word-break: break-all;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✕</div>
    <h1>Dokumen Tidak Valid / Tidak Ditemukan</h1>
    <p>
      Kode verifikasi tidak sah atau dokumen tidak terdaftar pada sistem kepegawaian SEDAKEP. Pastikan QR Code dipindai utuh langsung dari dokumen asli.
    </p>
    <code>${escapeHtml(code)}</code>
  </div>
</body>
</html>`;
};

const escapeHtml = (str: unknown): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

