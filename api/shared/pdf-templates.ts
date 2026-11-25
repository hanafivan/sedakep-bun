import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import {
  type AssignmentLetterPdfData,
  type AlibiLetterPdfData,
  type DispositionSheetPdfData,
  type ServiceStatementLetterPdfData,
  formatGradeRank,
  formatIndoDate,
} from './pdf';

const mm = 2.834645669;
const F4_PAGE: [number, number] = [210 * mm, 330 * mm];
const BLACK = rgb(0, 0, 0);

const wrap = (text: string, maxWidth: number, f: PDFFont, size: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const candidate = cur ? `${cur} ${w}` : w;
    if (f.widthOfTextAtSize(candidate, size) <= maxWidth) {
      cur = candidate;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
};

// ===========================================================================
// 1. SURAT TUGAS (Cerminan 100% presisi FPDF surattugas/cetak_surtug.php)
// ===========================================================================

export const buildAssignmentLetterPdf = async (
  data: AssignmentLetterPdfData,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(`Surat Tugas - ${data.letter_number || data.id}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = 25 * mm;
  const contentWidth = 165 * mm;
  const bottomMargin = (data.footnote ? Number(data.footnote) : 30) * mm;

  let page = doc.addPage(F4_PAGE);
  let y = F4_PAGE[1] - 15 * mm;

  const newPage = () => {
    page = doc.addPage(F4_PAGE);
    y = F4_PAGE[1] - 15 * mm;
  };

  const ensure = (needed: number) => {
    if (y - needed < bottomMargin) {
      newPage();
    }
  };

  // 1. Watermark DRAFT
  const isDraft = data.is_draft || !data.letter_number || data.decision !== 'accepted';
  if (isDraft) {
    const draftFile = Bun.file('assets/draft.png');
    if (await draftFile.exists()) {
      const draftBytes = Buffer.from(await draftFile.arrayBuffer());
      const draftImg = await doc.embedPng(draftBytes);
      page.drawImage(draftImg, {
        x: 50 * mm,
        y: F4_PAGE[1] - 25 * mm - 150 * mm,
        width: 100 * mm,
        height: 150 * mm,
        opacity: 0.35,
      });
    }
  }

  // 2. Logo Kemenag
  const logoFile = Bun.file('assets/logo_kemenag.jpg');
  if (await logoFile.exists()) {
    const logoBytes = Buffer.from(await logoFile.arrayBuffer());
    const logoImg = await doc.embedJpg(logoBytes);
    page.drawImage(logoImg, {
      x: left,
      y: y - 22 * mm,
      width: 23 * mm,
      height: 22 * mm,
    });
  }

  // 3. Kop Surat
  const kopLeft = left + 20 * mm;
  const kopWidth = 145 * mm;
  const drawKopLine = (text: string, size: number, isBold: boolean, gapDown: number) => {
    const f = isBold ? bold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: kopLeft + (kopWidth - w) / 2,
      y,
      size,
      font: f,
      color: BLACK,
    });
    y -= gapDown;
  };

  y -= 2 * mm;
  drawKopLine('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 13.5, true, 5 * mm);
  drawKopLine('KANTOR KEMENTERIAN AGAMA KABUPATEN SLEMAN', 11.5, true, 4.5 * mm);
  drawKopLine(data.instance_address || 'Jalan Dr. Radjimin, Sleman, Daerah Istimewa Yogyakarta 55511', 8.5, false, 3.8 * mm);
  drawKopLine('Telpon (0274) 868314, Faksimile (0274) 869675', 8.5, false, 3.8 * mm);
  drawKopLine('Situs: sleman.kemenag.go.id', 8.5, false, 4 * mm);

  page.drawLine({ start: { x: left, y: y + 2 }, end: { x: left + contentWidth, y: y + 2 }, thickness: 1.5, color: BLACK });
  page.drawLine({ start: { x: left, y }, end: { x: left + contentWidth, y }, thickness: 0.5, color: BLACK });

  y -= 10 * mm;

  // 4. Judul
  const title = 'SURAT TUGAS';
  const tW = bold.widthOfTextAtSize(title, 12);
  page.drawText(title, { x: left + (contentWidth - tW) / 2, y, size: 12, font: bold, color: BLACK });
  y -= 4.5 * mm;

  const numText = data.number_display || (data.letter_number ? `Nomor : ${data.letter_number}` : 'Nomor : DRAFT');
  const nW = font.widthOfTextAtSize(numText, 11);
  page.drawText(numText, { x: left + (contentWidth - nW) / 2, y, size: 11, font, color: BLACK });
  y -= 7 * mm;

  const drawLabeledBlock = (label: string, text: string | null | undefined, labelWidth = 30 * mm) => {
    if (!text) return;
    ensure(18);
    page.drawText(label, { x: left, y, size: 11, font, color: BLACK });
    page.drawText(':', { x: left + labelWidth, y, size: 11, font, color: BLACK });
    const textLines = wrap(text, contentWidth - labelWidth - 5 * mm, font, 11);
    textLines.forEach((line) => {
      ensure(16);
      page.drawText(line, { x: left + labelWidth + 5 * mm, y, size: 11, font, color: BLACK });
      y -= 5 * mm;
    });
    y -= 2 * mm;
  };

  drawLabeledBlock('Menimbang', data.consideration);
  drawLabeledBlock('Dasar', data.legal_basis);

  // 5. Memberi Tugas
  ensure(30);
  const assignTitle = 'Memberi Tugas';
  const aW = bold.widthOfTextAtSize(assignTitle, 11);
  page.drawText(assignTitle, { x: left + (contentWidth - aW) / 2, y, size: 11, font: bold, color: BLACK });
  y -= 6 * mm;

  page.drawText('Kepada', { x: left, y, size: 11, font, color: BLACK });
  page.drawText(':', { x: left + 20 * mm, y, size: 11, font, color: BLACK });

  // 6. Tabel Anggota
  if (data.members.length === 1 && data.members[0]?.name.toLowerCase().includes('terlampir')) {
    page.drawText('Daftar Terlampir', { x: left + 25 * mm, y, size: 11, font: bold, color: BLACK });
    y -= 7 * mm;
  } else {
    y -= 3 * mm;
    const colNoW = 10 * mm;
    const colNamaW = 85 * mm;
    const colJabW = 70 * mm;

    // Header tabel
    ensure(20);
    const thY = y;
    page.drawRectangle({ x: left, y: thY - 6 * mm, width: contentWidth, height: 6 * mm, borderColor: BLACK, borderWidth: 0.8 });
    page.drawLine({ start: { x: left + colNoW, y: thY - 6 * mm }, end: { x: left + colNoW, y: thY }, thickness: 0.8, color: BLACK });
    page.drawLine({ start: { x: left + colNoW + colNamaW, y: thY - 6 * mm }, end: { x: left + colNoW + colNamaW, y: thY }, thickness: 0.8, color: BLACK });

    page.drawText('No.', { x: left + 2.5 * mm, y: thY - 4.5 * mm, size: 10, font: bold, color: BLACK });
    page.drawText('Nama', { x: left + colNoW + 3 * mm, y: thY - 4.5 * mm, size: 10, font: bold, color: BLACK });
    page.drawText('Jabatan', { x: left + colNoW + colNamaW + 3 * mm, y: thY - 4.5 * mm, size: 10, font: bold, color: BLACK });
    y = thY - 6 * mm;

    data.members.forEach((m, idx) => {
      ensure(32);
      const rowY = y;
      const rowH = 12 * mm;

      page.drawRectangle({ x: left, y: rowY - rowH, width: contentWidth, height: rowH, borderColor: BLACK, borderWidth: 0.8 });
      page.drawLine({ start: { x: left + colNoW, y: rowY - rowH }, end: { x: left + colNoW, y: rowY }, thickness: 0.8, color: BLACK });
      page.drawLine({ start: { x: left + colNoW + colNamaW, y: rowY - rowH }, end: { x: left + colNoW + colNamaW, y: rowY }, thickness: 0.8, color: BLACK });

      page.drawText(String(idx + 1), { x: left + 3.5 * mm, y: rowY - 5 * mm, size: 10, font, color: BLACK });
      page.drawText(m.name, { x: left + colNoW + 3 * mm, y: rowY - 5 * mm, size: 10, font: bold, color: BLACK });

      const nipGol = [m.nip ? `NIP. ${m.nip}` : '', formatGradeRank(m.grade)].filter(Boolean).join(', ');
      if (nipGol) {
        page.drawText(nipGol, { x: left + colNoW + 3 * mm, y: rowY - 9.5 * mm, size: 9, font, color: BLACK });
      }

      page.drawText(m.position || '-', { x: left + colNoW + colNamaW + 3 * mm, y: rowY - 5 * mm, size: 9.5, font, color: BLACK });
      if (m.organization_name) {
        page.drawText(m.organization_name, { x: left + colNoW + colNamaW + 3 * mm, y: rowY - 9.5 * mm, size: 8.5, font, color: BLACK });
      }

      y = rowY - rowH;
    });
    y -= 4 * mm;
  }

  // 7. Untuk & Pelaksanaan
  ensure(30);
  page.drawText('Untuk', { x: left, y, size: 11, font, color: BLACK });
  page.drawText(':', { x: left + 20 * mm, y, size: 11, font, color: BLACK });

  if (data.content) {
    const contentLines = wrap(data.content, contentWidth - 25 * mm, font, 11);
    contentLines.forEach((cl) => {
      ensure(16);
      page.drawText(cl, { x: left + 25 * mm, y, size: 11, font, color: BLACK });
      y -= 5 * mm;
    });
  }
  y -= 2 * mm;

  const schedIndent = left + 25 * mm;
  const schedLabelW = 25 * mm;
  const schedTextW = contentWidth - 55 * mm;

  const drawSchedRow = (lbl: string, val: string | null | undefined) => {
    if (!val) return;
    ensure(18);
    page.drawText(lbl, { x: schedIndent, y, size: 11, font, color: BLACK });
    page.drawText(':', { x: schedIndent + schedLabelW, y, size: 11, font, color: BLACK });
    const lines = wrap(val, schedTextW, font, 11);
    lines.forEach((l) => {
      ensure(16);
      page.drawText(l, { x: schedIndent + schedLabelW + 5 * mm, y, size: 11, font, color: BLACK });
      y -= 5 * mm;
    });
  };

  const dayDateStr = [
    data.day_start || '',
    formatIndoDate(data.start_date),
    data.end_date && data.end_date !== data.start_date ? `s.d. ${data.day_end || ''} ${formatIndoDate(data.end_date)}` : '',
  ].filter(Boolean).join(' ');

  drawSchedRow('Hari/Tgl', dayDateStr);
  drawSchedRow('Waktu', [data.time_start, data.time_end ? `s.d. ${data.time_end}` : ''].filter(Boolean).join(' ') || 'Menyesuaikan jadwal masing-masing.');
  drawSchedRow('Tempat', data.place);

  if (data.notes && data.notes.length > 0) {
    ensure(20);
    page.drawText('Keterangan', { x: schedIndent, y, size: 11, font, color: BLACK });
    page.drawText(':', { x: schedIndent + schedLabelW, y, size: 11, font, color: BLACK });

    if (data.notes.length === 1) {
      const lines = wrap(data.notes[0]?.note || '-', schedTextW, font, 11);
      lines.forEach((l) => {
        ensure(16);
        page.drawText(l, { x: schedIndent + schedLabelW + 5 * mm, y, size: 11, font, color: BLACK });
        y -= 5 * mm;
      });
    } else {
      data.notes.forEach((n, idx) => {
        ensure(16);
        page.drawText(`${idx + 1}. `, { x: schedIndent + schedLabelW + 5 * mm, y, size: 11, font, color: BLACK });
        const lines = wrap(n.note, schedTextW - 7 * mm, font, 11);
        lines.forEach((l, lIdx) => {
          ensure(16);
          page.drawText(l, { x: schedIndent + schedLabelW + (lIdx === 0 ? 12 * mm : 12 * mm), y, size: 11, font, color: BLACK });
          y -= 5 * mm;
        });
      });
    }
  }

  y -= 4 * mm;

  // 8. Tanda Tangan
  ensure(80);
  const signX = left + 95 * mm;
  page.drawText(`Sleman, ${formatIndoDate(data.printed_at || data.created_at)}`, { x: signX, y, size: 11, font, color: BLACK });
  y -= 5 * mm;
  page.drawText(`${data.signer_position || 'Kepala'},`, { x: signX, y, size: 11, font, color: BLACK });
  y -= 6 * mm;

  if (data.verify_url) {
    const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 120 });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: signX + 15 * mm, y: y - 18 * mm, width: 18 * mm, height: 18 * mm });
    y -= 22 * mm;
  } else {
    y -= 20 * mm;
  }

  page.drawText(data.signer_name || 'Sidik Pramono', { x: signX, y, size: 11, font: bold, color: BLACK });
  y -= 8 * mm;

  // 9. Tembusan
  if (data.copies && data.copies.length > 0) {
    ensure(20 + data.copies.length * 14);
    page.drawText('Tembusan :', { x: left, y, size: 11, font, color: BLACK });
    y -= 5 * mm;
    data.copies.forEach((c, idx) => {
      ensure(14);
      page.drawText(`${idx + 1}. ${c.copy_to}`, { x: left + 5 * mm, y, size: 10, font, color: BLACK });
      y -= 4.5 * mm;
    });
  }

  return doc.save();
};

// ===========================================================================
// 2. SURAT ALIBI (Cerminan 100% presisi FPDF alibi/cetak_alibi.php)
// ===========================================================================

export const buildAlibiLetterPdf = async (
  data: AlibiLetterPdfData,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(`Surat Alibi - ${data.name}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = 25 * mm;
  const contentWidth = 165 * mm;

  let page = doc.addPage(F4_PAGE);
  let y = F4_PAGE[1] - 20 * mm;

  const newPage = () => {
    page = doc.addPage(F4_PAGE);
    y = F4_PAGE[1] - 20 * mm;
  };

  const ensure = (needed: number) => {
    if (y - needed < 20 * mm) {
      newPage();
    }
  };

  const isDraft = data.is_draft || data.status !== 'approved';
  if (isDraft) {
    const draftFile = Bun.file('assets/draft.png');
    if (await draftFile.exists()) {
      const draftBytes = Buffer.from(await draftFile.arrayBuffer());
      const draftImg = await doc.embedPng(draftBytes);
      page.drawImage(draftImg, {
        x: 50 * mm,
        y: F4_PAGE[1] - 25 * mm - 150 * mm,
        width: 100 * mm,
        height: 150 * mm,
        opacity: 0.35,
      });
    }
  }

  const logoFile = Bun.file('assets/logo_kemenag.jpg');
  if (await logoFile.exists()) {
    const logoBytes = Buffer.from(await logoFile.arrayBuffer());
    const logoImg = await doc.embedJpg(logoBytes);
    page.drawImage(logoImg, {
      x: left,
      y: y - 22 * mm,
      width: 23 * mm,
      height: 22 * mm,
    });
  }

  const kopLeft = left + 20 * mm;
  const kopWidth = 145 * mm;
  const drawKopLine = (text: string, size: number, isBold: boolean, gapDown: number) => {
    const f = isBold ? bold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: kopLeft + (kopWidth - w) / 2,
      y,
      size,
      font: f,
      color: BLACK,
    });
    y -= gapDown;
  };

  y -= 2 * mm;
  drawKopLine('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 13.5, true, 5 * mm);
  drawKopLine('KANTOR KEMENTERIAN AGAMA KABUPATEN SLEMAN', 11.5, true, 4.5 * mm);
  drawKopLine(data.instance_address || 'Jalan Dr. Radjimin, Sleman, Daerah Istimewa Yogyakarta 55511', 8.5, false, 3.8 * mm);
  drawKopLine('Telpon (0274) 868314, Faksimile (0274) 869675', 8.5, false, 3.8 * mm);
  drawKopLine('Situs: sleman.kemenag.go.id', 8.5, false, 4 * mm);

  page.drawLine({ start: { x: left, y: y + 2 }, end: { x: left + contentWidth, y: y + 2 }, thickness: 1.5, color: BLACK });
  page.drawLine({ start: { x: left, y }, end: { x: left + contentWidth, y }, thickness: 0.5, color: BLACK });

  y -= 10 * mm;

  const title = 'SURAT KETERANGAN / PEMBERITAHUAN / IZIN';
  const titleW = bold.widthOfTextAtSize(title, 12);
  page.drawText(title, { x: left + (contentWidth - titleW) / 2, y, size: 12, font: bold, color: BLACK });
  y -= 9 * mm;

  page.drawText('Yang bertanda tangan di bawah ini :', { x: left, y, size: 11, font, color: BLACK });
  y -= 7 * mm;

  const drawRow = (label: string, val: string) => {
    ensure(16);
    page.drawText(label, { x: left + 11 * mm, y, size: 10.5, font, color: BLACK });
    page.drawText(':', { x: left + 56 * mm, y, size: 10.5, font, color: BLACK });
    page.drawText(val || '-', { x: left + 60 * mm, y, size: 10.5, font, color: BLACK });
    y -= 5.5 * mm;
  };

  drawRow('Nama', data.name);
  drawRow('NIP', data.nip || '-');
  drawRow('Pangkat/Gol. Ruang', formatGradeRank(data.grade));
  drawRow('Jabatan', data.position || '-');

  const unitText = data.organization_name && data.organization_name !== 'Kantor Kementerian Agama Kab. Sleman'
    ? `${data.organization_name}\nKantor Kementerian Agama Kab. Sleman`
    : 'Kantor Kementerian Agama Kab. Sleman';
  const unitLines = unitText.split('\n');
  ensure(unitLines.length * 16);
  page.drawText('Satuan Organisasi', { x: left + 11 * mm, y, size: 10.5, font, color: BLACK });
  page.drawText(':', { x: left + 56 * mm, y, size: 10.5, font, color: BLACK });
  unitLines.forEach((ul, idx) => {
    page.drawText(ul, { x: left + 60 * mm, y: y - (idx * 4.5 * mm), size: 10.5, font, color: BLACK });
  });
  y -= (unitLines.length * 4.5 * mm) + 4 * mm;

  page.drawText('Dengan ini mohon izin/memberitahukan bahwa pada :', { x: left, y, size: 11, font, color: BLACK });
  y -= 7 * mm;

  const DAYS_ID = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  let dayName = '-';
  if (data.alibi_date) {
    const d = new Date(data.alibi_date);
    if (!isNaN(d.getTime())) dayName = DAYS_ID[d.getDay()] ?? '-';
  }

  drawRow('Hari', dayName);
  drawRow('Tanggal', formatIndoDate(data.alibi_date));
  y -= 4 * mm;

  const tStr = String(data.alibi_type || '').toLowerCase();
  const is1 = tStr === '1' || tStr.includes('tidak hadir');
  const is2 = tStr === '2' || tStr.includes('terlambat');
  const is3 = tStr === '3' || tStr.includes('pulang');
  const is4 = tStr === '4' || tStr.includes('tidak berada');
  const is5 = tStr === '5' || tStr.includes('pagi');
  const is6 = tStr === '6' || tStr.includes('sore');
  const is7 = tStr === '7' || (!is1 && !is2 && !is3 && !is4 && !is5 && !is6);

  const drawCheckbox = (checked: boolean, label: string) => {
    ensure(16);
    const box = checked ? '[ V ]' : '[    ]';
    page.drawText(box, { x: left + 11 * mm, y, size: 10.5, font: bold, color: BLACK });
    page.drawText(label, { x: left + 23 * mm, y, size: 10.5, font, color: BLACK });
    y -= 5.5 * mm;
  };

  drawCheckbox(is1, 'tidak hadir');
  drawCheckbox(is2, 'terlambat masuk kerja');
  drawCheckbox(is3, 'pulang sebelum waktunya');
  drawCheckbox(is4, 'tidak berada di tempat kerja');
  drawCheckbox(
    is5 || is6 || is7,
    `tidak mengisi daftar hadir ${is5 ? '(pagi)' : is6 ? '(sore)' : ''}`.trim(),
  );

  y -= 4 * mm;

  const reasonText = `Dikarenakan ${data.reason || '-'} dari pukul ${data.time_start || '07:30'} WIB s.d. ${data.time_end || '16:00'} WIB.`;
  const reasonLines = wrap(reasonText, contentWidth, font, 11);
  ensure(reasonLines.length * 16);
  reasonLines.forEach((rl) => {
    page.drawText(rl, { x: left, y, size: 11, font, color: BLACK });
    y -= 5.5 * mm;
  });

  y -= 2 * mm;
  const closing = 'Demikian keterangan ini saya buat untuk dapat dipergunakan sebagaimana mestinya.';
  page.drawText(closing, { x: left, y, size: 11, font, color: BLACK });
  y -= 10 * mm;

  ensure(95);
  const colLeftX = left;
  const colRightX = left + 95 * mm;

  page.drawText(`Sleman, ${formatIndoDate(data.printed_at || data.created_at)}`, {
    x: colRightX,
    y,
    size: 10.5,
    font,
    color: BLACK,
  });
  y -= 5 * mm;

  page.drawText(`${data.approver_1_position || 'Atasan Langsung'},`, {
    x: colLeftX,
    y,
    size: 10.5,
    font,
    color: BLACK,
  });
  page.drawText(`${data.position || 'Pemohon'},`, {
    x: colRightX,
    y,
    size: 10.5,
    font,
    color: BLACK,
  });
  y -= 6 * mm;

  if (data.verify_url && !isDraft) {
    const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 100 });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: colLeftX + 15 * mm, y: y - 15 * mm, width: 15 * mm, height: 15 * mm });
    page.drawImage(qrImg, { x: colRightX + 15 * mm, y: y - 15 * mm, width: 15 * mm, height: 15 * mm });
    y -= 19 * mm;
  } else {
    y -= 18 * mm;
  }

  page.drawText(data.approver_1_name || '-', { x: colLeftX, y, size: 10.5, font: bold, color: BLACK });
  page.drawText(data.name, { x: colRightX, y, size: 10.5, font: bold, color: BLACK });
  y -= 4.5 * mm;

  page.drawText(`NIP. ${data.approver_1_nip || '-'}`, { x: colLeftX, y, size: 10, font, color: BLACK });
  page.drawText(`NIP. ${data.nip || '-'}`, { x: colRightX, y, size: 10, font, color: BLACK });
  y -= 8 * mm;

  if (data.approver_2_name && data.approver_2_name !== '-') {
    ensure(55);
    const midX = left + 45 * mm;
    page.drawText('Mengetahui,', { x: midX, y, size: 10.5, font, color: BLACK });
    y -= 5 * mm;
    page.drawText(data.approver_2_position || 'Kepala', { x: midX, y, size: 10.5, font, color: BLACK });
    y -= 6 * mm;

    if (data.verify_url && !isDraft) {
      const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 100 });
      const qrImg = await doc.embedPng(qrBuf);
      page.drawImage(qrImg, { x: midX + 10 * mm, y: y - 15 * mm, width: 15 * mm, height: 15 * mm });
      y -= 19 * mm;
    } else {
      y -= 18 * mm;
    }

    page.drawText(data.approver_2_name, { x: midX, y, size: 10.5, font: bold, color: BLACK });
    y -= 4.5 * mm;
    page.drawText(`NIP. ${data.approver_2_nip || '-'}`, { x: midX, y, size: 10, font, color: BLACK });
    y -= 7 * mm;
  }

  if (data.verify_url && !isDraft) {
    ensure(20);
    page.drawLine({ start: { x: left, y }, end: { x: left + contentWidth, y }, thickness: 0.5, color: BLACK });
    y -= 4 * mm;
    page.drawText('Ditandatangani secara elektronik melalui aplikasi SEDAKEP', {
      x: left,
      y,
      size: 8.5,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 3.5 * mm;
    page.drawText(data.verify_url, { x: left, y, size: 8, font, color: rgb(0.3, 0.3, 0.3) });
  }

  return doc.save();
};

// ===========================================================================
// 3. LEMBAR DISPOSISI (Cerminan 100% presisi FPDF disposisi/cetak_dispo.php)
// ===========================================================================

export const buildDispositionSheetPdf = async (
  data: DispositionSheetPdfData,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(`Lembar Disposisi - ${data.letter_number || data.id}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = 25 * mm;
  const contentWidth = 165 * mm;

  let page = doc.addPage(F4_PAGE);
  let y = F4_PAGE[1] - 20 * mm;

  const logoFile = Bun.file('assets/logo_kemenag.jpg');
  if (await logoFile.exists()) {
    const logoBytes = Buffer.from(await logoFile.arrayBuffer());
    const logoImg = await doc.embedJpg(logoBytes);
    page.drawImage(logoImg, {
      x: left,
      y: y - 22 * mm,
      width: 23 * mm,
      height: 22 * mm,
    });
  }

  const kopLeft = left + 20 * mm;
  const kopWidth = 145 * mm;
  const drawKopLine = (text: string, size: number, isBold: boolean, gapDown: number) => {
    const f = isBold ? bold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: kopLeft + (kopWidth - w) / 2,
      y,
      size,
      font: f,
      color: BLACK,
    });
    y -= gapDown;
  };

  y -= 2 * mm;
  drawKopLine('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 13.5, true, 5 * mm);
  drawKopLine('KANTOR KEMENTERIAN AGAMA KABUPATEN SLEMAN', 11.5, true, 4.5 * mm);
  drawKopLine(data.instance_address || 'Jalan Dr. Radjimin, Sleman, Daerah Istimewa Yogyakarta 55511', 8.5, false, 3.8 * mm);
  drawKopLine('Telpon (0274) 868314, Faksimile (0274) 869675', 8.5, false, 3.8 * mm);
  drawKopLine('Situs: sleman.kemenag.go.id', 8.5, false, 4 * mm);

  page.drawLine({ start: { x: left, y: y + 2 }, end: { x: left + contentWidth, y: y + 2 }, thickness: 1.5, color: BLACK });
  page.drawLine({ start: { x: left, y }, end: { x: left + contentWidth, y }, thickness: 0.5, color: BLACK });

  y -= 10 * mm;

  // Judul Box: LEMBAR DISPOSISI
  page.drawRectangle({
    x: left,
    y: y - 10 * mm,
    width: contentWidth,
    height: 12 * mm,
    borderColor: BLACK,
    borderWidth: 1,
  });
  const boxTitle = 'LEMBAR DISPOSISI';
  const boxTitleW = bold.widthOfTextAtSize(boxTitle, 12);
  page.drawText(boxTitle, {
    x: left + (contentWidth - boxTitleW) / 2,
    y: y - 6 * mm,
    size: 12,
    font: bold,
    color: BLACK,
  });
  y -= 10 * mm;

  const drawTableRow = (
    c1Label: string,
    c1Val: string,
    c2Label?: string,
    c2Val?: string,
    rowHeight: number = 7 * mm,
  ) => {
    const rowY = y - rowHeight;
    page.drawRectangle({
      x: left,
      y: rowY,
      width: contentWidth,
      height: rowHeight,
      borderColor: BLACK,
      borderWidth: 0.8,
    });

    if (c2Label !== undefined) {
      page.drawLine({
        start: { x: left + 103 * mm, y: rowY },
        end: { x: left + 103 * mm, y },
        thickness: 0.8,
        color: BLACK,
      });

      page.drawText(c1Label, { x: left + 2 * mm, y: rowY + 2 * mm, size: 9.5, font: bold, color: BLACK });
      page.drawText(':', { x: left + 32 * mm, y: rowY + 2 * mm, size: 9.5, font, color: BLACK });
      page.drawText(c1Val || '-', { x: left + 35 * mm, y: rowY + 2 * mm, size: 9.5, font, color: BLACK });

      page.drawText(c2Label, { x: left + 105 * mm, y: rowY + 2 * mm, size: 9.5, font: bold, color: BLACK });
      page.drawText(':', { x: left + 135 * mm, y: rowY + 2 * mm, size: 9.5, font, color: BLACK });
      page.drawText(c2Val || '-', { x: left + 138 * mm, y: rowY + 2 * mm, size: 9.5, font, color: BLACK });
    } else {
      page.drawText(c1Label, { x: left + 2 * mm, y: rowY + 2 * mm, size: 9.5, font: bold, color: BLACK });
      page.drawText(':', { x: left + 32 * mm, y: rowY + 2 * mm, size: 9.5, font, color: BLACK });
      page.drawText(c1Val || '-', { x: left + 35 * mm, y: rowY + 2 * mm, size: 9.5, font, color: BLACK });
    }

    y = rowY;
  };

  drawTableRow('Nomor Surat', data.letter_number || '-', 'Nomor Agenda', data.agenda_number || '-');
  drawTableRow('Tanggal Surat', formatIndoDate(data.letter_date), 'Nomor Tiket', data.ticket_number || '-');
  drawTableRow('Tanggal Diterima', formatIndoDate(data.received_date), 'Kode Surat', data.classification_code || '-');
  drawTableRow('Asal Surat', data.origin || '-');
  drawTableRow('Perihal', data.content || '-', undefined, undefined, 10 * mm);

  y -= 4 * mm;
  const verifRowH = 10 * mm;
  const verifY = y - verifRowH;
  page.drawRectangle({
    x: left,
    y: verifY,
    width: contentWidth,
    height: verifRowH,
    borderColor: BLACK,
    borderWidth: 0.8,
  });
  page.drawLine({
    start: { x: left + 103 * mm, y: verifY },
    end: { x: left + 103 * mm, y },
    thickness: 0.8,
    color: BLACK,
  });

  page.drawText(
    data.reviewer_checked !== false
      ? 'Telah Diperiksa Oleh Ka. Subbag TU'
      : 'Belum Diperiksa Oleh Ka. Subbag TU',
    { x: left + 3 * mm, y: verifY + 3.5 * mm, size: 10, font: bold, color: BLACK },
  );

  page.drawText('Paraf :', { x: left + 105 * mm, y: verifY + 3.5 * mm, size: 10, font, color: BLACK });
  if (data.reviewer_checked !== false && data.verify_url) {
    const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 80 });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: left + 130 * mm, y: verifY + 1 * mm, width: 8 * mm, height: 8 * mm });
  }

  y = verifY - 5 * mm;

  const firstDispo = data.dispositions[0] || {};
  const dispoRowH = 26 * mm;
  const dispoY = y - dispoRowH;
  page.drawRectangle({
    x: left,
    y: dispoY,
    width: contentWidth,
    height: dispoRowH,
    borderColor: BLACK,
    borderWidth: 0.8,
  });

  page.drawText('Disposisi kepada', { x: left + 2 * mm, y: y - 5 * mm, size: 9.5, font: bold, color: BLACK });
  page.drawText(':', { x: left + 35 * mm, y: y - 5 * mm, size: 9.5, font, color: BLACK });
  page.drawText(firstDispo.target_name || '-', { x: left + 38 * mm, y: y - 5 * mm, size: 9.5, font, color: BLACK });

  page.drawText('Isi disposisi', { x: left + 2 * mm, y: y - 11 * mm, size: 9.5, font: bold, color: BLACK });
  page.drawText(':', { x: left + 35 * mm, y: y - 11 * mm, size: 9.5, font, color: BLACK });
  page.drawText(firstDispo.instruction || '-', { x: left + 38 * mm, y: y - 11 * mm, size: 9.5, font, color: BLACK });

  page.drawText('Catatan', { x: left + 2 * mm, y: y - 17 * mm, size: 9.5, font: bold, color: BLACK });
  page.drawText(':', { x: left + 35 * mm, y: y - 17 * mm, size: 9.5, font, color: BLACK });
  page.drawText(firstDispo.notes || '-', { x: left + 38 * mm, y: y - 17 * mm, size: 9.5, font, color: BLACK });

  page.drawText('Paraf Pimpinan', { x: left + 2 * mm, y: y - 23 * mm, size: 9.5, font: bold, color: BLACK });
  page.drawText(':', { x: left + 35 * mm, y: y - 23 * mm, size: 9.5, font, color: BLACK });
  if (firstDispo.target_name && data.verify_url) {
    const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 80 });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: left + 38 * mm, y: y - 25.5 * mm, width: 7 * mm, height: 7 * mm });
  }

  y = dispoY - 5 * mm;

  const firstFinal = data.finals?.[0];
  if (firstFinal) {
    const finalRowH = 18 * mm;
    const finalY = y - finalRowH;
    page.drawRectangle({
      x: left,
      y: finalY,
      width: contentWidth,
      height: finalRowH,
      borderColor: BLACK,
      borderWidth: 0.8,
    });

    page.drawText('Pelaksana disposisi', { x: left + 2 * mm, y: y - 5 * mm, size: 9.5, font: bold, color: BLACK });
    page.drawText(':', { x: left + 35 * mm, y: y - 5 * mm, size: 9.5, font, color: BLACK });
    page.drawText(firstFinal.name || '-', { x: left + 38 * mm, y: y - 5 * mm, size: 9.5, font, color: BLACK });

    page.drawText('Instruksi', { x: left + 2 * mm, y: y - 11 * mm, size: 9.5, font: bold, color: BLACK });
    page.drawText(':', { x: left + 35 * mm, y: y - 11 * mm, size: 9.5, font, color: BLACK });
    page.drawText(firstFinal.instruction || '-', { x: left + 38 * mm, y: y - 11 * mm, size: 9.5, font, color: BLACK });

    page.drawText('Paraf Pelaksana', { x: left + 2 * mm, y: y - 16 * mm, size: 9.5, font: bold, color: BLACK });
    page.drawText(':', { x: left + 35 * mm, y: y - 16 * mm, size: 9.5, font, color: BLACK });

    y = finalY - 6 * mm;
  }

  const officerX = left + 100 * mm;
  page.drawText('Petugas Disposisi,', { x: officerX, y, size: 10, font, color: BLACK });
  y -= 5 * mm;

  if (data.verify_url) {
    const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 100 });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: officerX + 10 * mm, y: y - 15 * mm, width: 15 * mm, height: 15 * mm });
    y -= 18 * mm;
  } else {
    y -= 15 * mm;
  }

  page.drawText(data.officer_name || 'Petugas PTSP', { x: officerX, y, size: 10, font: bold, color: BLACK });

  return doc.save();
};

// ===========================================================================
// 4. SURAT PERNYATAAN LAYANAN SPHD / SPPID (Cerminan 100% presisi FPDF legacy)
// ===========================================================================

export const buildServiceStatementLetterPdf = async (
  data: ServiceStatementLetterPdfData,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const isSphd = data.letter_type === 'sphd';
  doc.setTitle(isSphd ? `SPHD - ${data.employee_name}` : `SPPID - ${data.employee_name}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const left = 25 * mm;
  const contentWidth = 165 * mm;

  let page = doc.addPage(F4_PAGE);
  let y = F4_PAGE[1] - 20 * mm;

  const logoFile = Bun.file('assets/logo_kemenag.jpg');
  if (await logoFile.exists()) {
    const logoBytes = Buffer.from(await logoFile.arrayBuffer());
    const logoImg = await doc.embedJpg(logoBytes);
    page.drawImage(logoImg, {
      x: left,
      y: y - 22 * mm,
      width: 23 * mm,
      height: 22 * mm,
    });
  }

  const kopLeft = left + 20 * mm;
  const kopWidth = 145 * mm;
  const drawKopLine = (text: string, size: number, isBold: boolean, gapDown: number) => {
    const f = isBold ? bold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: kopLeft + (kopWidth - w) / 2,
      y,
      size,
      font: f,
      color: BLACK,
    });
    y -= gapDown;
  };

  y -= 2 * mm;
  drawKopLine('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 13.5, true, 5 * mm);
  drawKopLine('KANTOR KEMENTERIAN AGAMA KABUPATEN SLEMAN', 11.5, true, 4.5 * mm);
  drawKopLine(data.instance_address || 'Jalan Dr. Radjimin, Sleman, Daerah Istimewa Yogyakarta 55511', 8.5, false, 3.8 * mm);
  drawKopLine('Telpon (0274) 868314, Faksimile (0274) 869675', 8.5, false, 3.8 * mm);
  drawKopLine('Situs: sleman.kemenag.go.id', 8.5, false, 4 * mm);

  page.drawLine({ start: { x: left, y: y + 2 }, end: { x: left + contentWidth, y: y + 2 }, thickness: 1.5, color: BLACK });
  page.drawLine({ start: { x: left, y }, end: { x: left + contentWidth, y }, thickness: 0.5, color: BLACK });

  y -= 10 * mm;

  const centerText = (text: string, size: number, isBold: boolean, gapDown: number) => {
    const f = isBold ? bold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: left + (contentWidth - w) / 2,
      y,
      size,
      font: f,
      color: BLACK,
    });
    y -= gapDown;
  };

  centerText('SURAT PERNYATAAN', 12, true, 5.5 * mm);
  if (isSphd) {
    centerText('TIDAK PERNAH DIJATUHI HUKUMAN DISIPLIN TINGKAT SEDANG/BERAT', 11.5, true, 5.5 * mm);
  } else {
    centerText('TIDAK SEDANG MENJALANI PROSES PIDANA ATAU PERNAH DIPIDANA PENJARA', 11, true, 4.8 * mm);
    centerText('BERDASARKAN PUTUSAN PENGADILAN YANG TELAH BERKEKUATAN HUKUM TETAP', 11, true, 5.5 * mm);
  }

  const dateIssued = data.issued_at ? new Date(data.issued_at) : new Date();
  const m = String(dateIssued.getMonth() + 1).padStart(2, '0');
  const yr = dateIssued.getFullYear();
  const rawNum = data.letter_number || String(data.id);
  const formattedNumber = `NOMOR : ${rawNum}/Kk.12.04/1/Kp.04.1/${m}/${yr}`;
  centerText(formattedNumber, 11, false, 8 * mm);

  page.drawText('Yang bertanda tangan di bawah ini :', { x: left, y, size: 11, font, color: BLACK });
  y -= 6 * mm;

  const drawRow = (label: string, val: string) => {
    page.drawText(label, { x: left + 11 * mm, y, size: 10.5, font, color: BLACK });
    page.drawText(':', { x: left + 56 * mm, y, size: 10.5, font, color: BLACK });
    page.drawText(val || '-', { x: left + 60 * mm, y, size: 10.5, font, color: BLACK });
    y -= 5.5 * mm;
  };

  drawRow('Nama', data.signer_name || 'H. Sidik Pramono, S.Ag., M.Si.');
  drawRow('NIP', data.signer_nip || '196903271997031002');
  drawRow('Pangkat/Gol. Ruang', formatGradeRank(data.signer_grade || 'IV/b'));
  drawRow('Jabatan', data.signer_position || 'Kepala Kantor Kementerian Agama Kab. Sleman');

  y -= 3 * mm;
  page.drawText('Dengan ini menyatakan dengan sesungguhnya bahwa Pegawai Negeri Sipil di bawah ini :', {
    x: left,
    y,
    size: 11,
    font,
    color: BLACK,
  });
  y -= 6 * mm;

  drawRow('Nama', data.employee_name);
  drawRow('NIP', data.employee_nip || '-');
  drawRow('Tempat, Tgl Lahir', `${data.birth_place || '-'}, ${formatIndoDate(data.birth_date)}`);
  drawRow('Pangkat/Gol. Ruang', formatGradeRank(data.employee_grade));
  drawRow('Jabatan', data.employee_position || '-');

  const unitText = data.employee_organization && data.employee_organization !== 'Kantor Kementerian Agama Kab. Sleman'
    ? `${data.employee_organization}\nKantor Kementerian Agama Kab. Sleman`
    : 'Kantor Kementerian Agama Kab. Sleman';
  const unitLines = unitText.split('\n');
  page.drawText('Satuan Organisasi', { x: left + 11 * mm, y, size: 10.5, font, color: BLACK });
  page.drawText(':', { x: left + 56 * mm, y, size: 10.5, font, color: BLACK });
  unitLines.forEach((ul, idx) => {
    page.drawText(ul, { x: left + 60 * mm, y: y - (idx * 4.5 * mm), size: 10.5, font, color: BLACK });
  });
  y -= (unitLines.length * 4.5 * mm) + 4 * mm;

  const statementText = isSphd
    ? 'Dalam satu tahun terakhir tidak pernah dijatuhi hukuman disiplin tingkat sedang/berat.'
    : 'Tidak sedang menjalani proses pidana atau pernah dipidana penjara berdasarkan putusan pengadilan yang telah berkekuatan hukum tetap karena melakukan tindak pidana kejahatan jabatan atau tindak pidana kejahatan yang ada hubungannya dengan jabatan dan/atau pidana umum.';
  const statementLines = wrap(statementText, contentWidth, font, 11);
  statementLines.forEach((sl) => {
    page.drawText(sl, { x: left, y, size: 11, font, color: BLACK });
    y -= 5.5 * mm;
  });

  y -= 3 * mm;
  const closingText =
    'Demikian surat pernyataan ini saya buat dengan sesungguhnya dengan mengingat sumpah jabatan dan apabila dikemudian hari ternyata isi surat pernyataan ini tidak benar yang mengakibatkan kerugian bagi negara, maka saya bersedia menanggung kerugian tersebut.';
  const closingLines = wrap(closingText, contentWidth, font, 11);
  closingLines.forEach((cl) => {
    page.drawText(cl, { x: left, y, size: 11, font, color: BLACK });
    y -= 5.5 * mm;
  });

  y -= 8 * mm;

  const signX = left + 95 * mm;
  page.drawText(`Sleman, ${formatIndoDate(data.issued_at)}`, { x: signX, y, size: 10.5, font, color: BLACK });
  y -= 5 * mm;
  page.drawText(`${data.signer_position || 'Kepala'},`, { x: signX, y, size: 10.5, font, color: BLACK });
  y -= 6 * mm;

  if (data.verify_url) {
    const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 100 });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: signX + 15 * mm, y: y - 16 * mm, width: 16 * mm, height: 16 * mm });
    y -= 20 * mm;
  } else {
    y -= 18 * mm;
  }

  page.drawText(data.signer_name || 'H. Sidik Pramono, S.Ag., M.Si.', { x: signX, y, size: 10.5, font: bold, color: BLACK });

  return doc.save();
};

