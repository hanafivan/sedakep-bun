import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';

// ---------------------------------------------------------------------------
// Tipe data untuk PDF resmi Kemenag Sleman
// ---------------------------------------------------------------------------

export type BknLeaveFormData = {
  /** Identitas pemohon */
  name: string;
  nip?: string | null;
  grade?: string | null;          // Golongan/ruang
  position?: string | null;
  organization?: string | null;
  address?: string | null;
  phone?: string | null;

  /** Data cuti */
  leave_type: string;
  duration: number;
  duration_unit?: string;
  start_date: string;
  end_date: string;
  reason?: string | null;

  /** Saldo kuota (opsional, untuk bagian III) */
  quota_n?: number | null;
  quota_n1?: number | null;
  quota_n2?: number | null;

  /** Atasan 1 */
  approver_1_name?: string | null;
  approver_1_nip?: string | null;
  approver_1_position?: string | null;

  /** Atasan 2 */
  approver_2_name?: string | null;
  approver_2_nip?: string | null;
  approver_2_position?: string | null;

  /** Kop instansi */
  instance_name?: string | null;
  instance_address?: string | null;
};

export type OfficialLeaveLetterData = {
  /** Nomor surat */
  number: string;
  issued_at?: string | null;

  /** Identitas pegawai */
  name: string;
  nip?: string | null;
  grade?: string | null;
  position?: string | null;
  organization?: string | null;

  /** Data cuti */
  leave_type: string;
  duration: number;
  duration_unit?: string;
  start_date: string;
  end_date: string;
  reason?: string | null;
  address?: string | null;
  phone?: string | null;

  /** Pejabat penanda tangan */
  official_position?: string | null;
  official_name?: string | null;

  /** Instansi */
  instance_name?: string | null;
  instance_address?: string | null;

  /** Atasan untuk pengesahan */
  approver_1_name?: string | null;
  approver_1_nip?: string | null;
  approver_1_position?: string | null;
  approver_2_name?: string | null;
  approver_2_nip?: string | null;
  approver_2_position?: string | null;

  /** QR verifikasi */
  verify_url?: string | null;
};

/**
 * Pembuat PDF surat (Fase 13) — pengganti FPDF legacy.
 *
 * Satu builder generik dipakai surat tugas, SK cuti, SPHD/SPPK, dsb: kop
 * instansi, judul, nomor, paragraf, daftar, tabel, penanda tangan, dan QR
 * verifikasi. Hasilnya Uint8Array yang diunggah ke MinIO lewat documents.
 */

export type LetterTable = { headers: string[]; rows: string[][] };
export type LetterPdfInput = {
  /** Baris kop: baris pertama dianggap nama instansi (tebal). */
  kop?: string[];
  title: string;
  subtitle?: string;
  paragraphs?: string[];
  bullet?: string[];
  table?: LetterTable;
  closing?: string[];
  signer?: { city?: string; date?: string; position?: string; name?: string };
  qr?: { text: string; caption?: string };
};

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const CONTENT_WIDTH = A4[0] - MARGIN * 2;
const BLACK = rgb(0, 0, 0);
const GRAY = rgb(0.35, 0.35, 0.35);

const wrap = (text: string, font: PDFFont, size: number, maxWidth: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
};

export const buildLetterPdf = async (input: LetterPdfInput): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(input.title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage(A4);
  let y = A4[1] - MARGIN;

  const newPage = () => {
    page = doc.addPage(A4);
    y = A4[1] - MARGIN;
  };
  const ensure = (needed: number) => {
    if (y - needed < MARGIN + 20) newPage();
  };
  const text = (
    value: string,
    opts: { font?: PDFFont; size?: number; align?: 'left' | 'center' | 'right'; color?: typeof BLACK; x?: number; maxWidth?: number } = {},
  ) => {
    const usedFont = opts.font ?? font;
    const size = opts.size ?? 11;
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
    const lines = wrap(value, usedFont, size, maxWidth);
    for (const line of lines) {
      ensure(size + 4);
      const width = usedFont.widthOfTextAtSize(line, size);
      const x =
        opts.align === 'center'
          ? MARGIN + (CONTENT_WIDTH - width) / 2
          : opts.align === 'right'
            ? A4[0] - MARGIN - width
            : opts.x ?? MARGIN;
      page.drawText(line, { x, y: y - size, size, font: usedFont, color: opts.color ?? BLACK });
      y -= size + 4;
    }
  };

  // Kop instansi.
  if (input.kop && input.kop.length > 0) {
    const [first, ...rest] = input.kop;
    text(first ?? '', { font: bold, size: 14, align: 'center' });
    for (const line of rest) text(line, { size: 10, align: 'center', color: GRAY });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: A4[0] - MARGIN, y },
      thickness: 1.5,
      color: BLACK,
    });
    y -= 18;
  }

  // Judul + nomor.
  text(input.title, { font: bold, size: 14, align: 'center' });
  if (input.subtitle) {
    y -= 2;
    text(input.subtitle, { size: 11, align: 'center' });
  }
  y -= 12;

  for (const paragraph of input.paragraphs ?? []) {
    ensure(20);
    text(paragraph, { size: 11 });
    y -= 6;
  }

  for (const item of input.bullet ?? []) {
    text(`- ${item}`, { size: 11 });
  }

  if (input.table) {
    const cols = input.table.headers.length || 1;
    const colWidth = CONTENT_WIDTH / cols;
    const rowLines = (cells: string[], cellFont: PDFFont) =>
      cells.map((cell) => wrap(cell, cellFont, 9, colWidth - 8));

    ensure(24);
    const headerLines = rowLines(input.table.headers, bold);
    const headerHeight = Math.max(...headerLines.map((l) => l.length)) * 12 + 6;
    // Header background + border.
    page.drawRectangle({
      x: MARGIN,
      y: y - headerHeight,
      width: CONTENT_WIDTH,
      height: headerHeight,
      color: rgb(0.92, 0.92, 0.92),
      borderColor: BLACK,
      borderWidth: 0.7,
    });
    let headerY = y - 12;
    input.table.headers.forEach((cell, index) => {
      page.drawText(String(cell), { x: MARGIN + index * colWidth + 4, y: headerY, size: 9, font: bold });
    });
    y -= headerHeight;

    for (const row of input.table.rows) {
      const lines = rowLines(row, font);
      const rowHeight = Math.max(...lines.map((l) => l.length)) * 11 + 6;
      ensure(rowHeight + 4);
      page.drawRectangle({
        x: MARGIN,
        y: y - rowHeight,
        width: CONTENT_WIDTH,
        height: rowHeight,
        borderColor: BLACK,
        borderWidth: 0.5,
      });
      lines.forEach((cellLines, index) => {
        cellLines.forEach((line, lineIndex) => {
          page.drawText(line, {
            x: MARGIN + index * colWidth + 4,
            y: y - 11 - lineIndex * 11,
            size: 9,
            font,
          });
        });
      });
      y -= rowHeight;
    }
    y -= 10;
  }

  for (const paragraph of input.closing ?? []) {
    ensure(20);
    text(paragraph, { size: 11 });
    y -= 6;
  }

  // Penanda tangan (kanan bawah).
  if (input.signer) {
    ensure(90);
    y -= 20;
    const blockX = A4[0] - MARGIN - 200;
    let signY = y;
    const drawSign = (value: string, useBold = false) => {
      const usedFont = useBold ? bold : font;
      const width = usedFont.widthOfTextAtSize(value, 11);
      page.drawText(value, { x: A4[0] - MARGIN - width, y: signY - 11, size: 11, font: usedFont });
      signY -= 16;
    };
    if (input.signer.city || input.signer.date) {
      drawSign([input.signer.city, input.signer.date].filter(Boolean).join(', '));
    }
    if (input.signer.position) drawSign(input.signer.position);
    signY -= 50; // ruang tanda tangan
    if (input.signer.name) drawSign(input.signer.name, true);
    y = signY;
  }

  // QR verifikasi (kiri bawah).
  if (input.qr) {
    ensure(96);
    const qrPng = await QRCode.toBuffer(input.qr.text, { type: 'png', margin: 1, width: 220 });
    const image = await doc.embedPng(qrPng);
    const size = 72;
    page.drawImage(image, { x: MARGIN, y: MARGIN, width: size, height: size });
    page.drawText(input.qr.caption ?? 'Pindai untuk verifikasi', {
      x: MARGIN + size + 8,
      y: MARGIN + size - 12,
      size: 8,
      font,
      color: GRAY,
    });
  }

  return doc.save();
};

// ---------------------------------------------------------------------------
// Helper pangkat & tanggal Indonesia untuk surat kedinasan
// ---------------------------------------------------------------------------

export const formatGradeRank = (grade: string | null | undefined): string => {
  if (!grade) return '-';
  const g = grade.trim();
  const map: Record<string, string> = {
    'IV/e': 'Pembina Utama, IV/e',
    'IV/d': 'Pembina Utama Madya, IV/d',
    'IV/c': 'Pembina Utama Muda, IV/c',
    'IV/b': 'Pembina Tk. I, IV/b',
    'IV/a': 'Pembina, IV/a',
    'III/d': 'Penata Tk. I, III/d',
    'III/c': 'Penata, III/c',
    'III/b': 'Penata Muda Tk. I, III/b',
    'III/a': 'Penata Muda, III/a',
    'II/d': 'Pengatur Tk. I, II/d',
    'II/c': 'Pengatur, II/c',
    'II/b': 'Pengatur Muda Tk. I, II/b',
    'II/a': 'Pengatur Muda, II/a',
    'I/d': 'Juru Tk. I, I/d',
    'I/c': 'Juru, I/c',
    'I/b': 'Juru Muda Tk. I, I/b',
    'I/a': 'Juru Muda, I/a',
  };
  return map[g] ?? (map[g.toUpperCase()] || g);
};

const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export const formatIndoDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const parts = String(dateStr).slice(0, 10).split('-');
  if (parts.length !== 3) return String(dateStr);
  const [y, m, d] = parts;
  return `${Number(d)} ${MONTHS_ID[Number(m) - 1] ?? m} ${y}`;
};

const F4: [number, number] = [595.28, 935.43]; // 210 x 330 mm

/**
 * Formulir Permintaan dan Pemberian Cuti BKN (Perka BKN No. 24 Tahun 2017)
 * Memuat 8 bagian lengkap: Data Pegawai, Jenis Cuti, Alasan, Lamanya Cuti,
 * Catatan Cuti (riwayat N/N-1/N-2), Alamat, Pertimbangan Atasan, dan Keputusan Pejabat.
 */
export const buildBknLeaveFormPdf = async (data: BknLeaveFormData): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(`Formulir Permintaan Cuti - ${data.name}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(F4);

  const left = 40;
  const contentWidth = 515;
  let y = F4[1] - 32;

  const BLACK = rgb(0, 0, 0);
  const GRAY_BG = rgb(0.93, 0.93, 0.93);
  const LINE_COLOR = rgb(0.2, 0.2, 0.2);

  // Helper draw table section header
  const drawSectionHeader = (title: string, height = 14) => {
    page.drawRectangle({
      x: left,
      y: y - height,
      width: contentWidth,
      height,
      color: GRAY_BG,
      borderColor: LINE_COLOR,
      borderWidth: 0.8,
    });
    page.drawText(title, {
      x: left + 5,
      y: y - height + 3.5,
      size: 8,
      font: bold,
      color: BLACK,
    });
    y -= height;
  };

  // Header BKN No 24 Tahun 2017 (kanan atas)
  const headerLines = [
    'ANAK LAMPIRAN 1.b',
    'PERATURAN BADAN KEPEGAWAIAN NEGARA REPUBLIK INDONESIA',
    'NOMOR 24 TAHUN 2017',
    'TENTANG',
    'TATA CARA PEMBERIAN CUTI PEGAWAI NEGERI SIPIL',
  ];
  let headerY = y;
  for (const line of headerLines) {
    const width = font.widthOfTextAtSize(line, 7.5);
    page.drawText(line, {
      x: left + contentWidth - width,
      y: headerY,
      size: 7.5,
      font: bold,
      color: BLACK,
    });
    headerY -= 10;
  }

  // Tanggal dan tujuan surat
  headerY -= 6;
  const destLines = [
    `Sleman, ${formatIndoDate(data.start_date || new Date().toISOString())}`,
    'Kepada',
    `Yth. ${data.approver_2_position ?? 'Kepala Kantor Kementerian Agama Kab. Sleman'}`,
    'Di Tempat',
  ];
  for (const line of destLines) {
    page.drawText(line, {
      x: left + 280,
      y: headerY,
      size: 8,
      font,
      color: BLACK,
    });
    headerY -= 11;
  }
  y = headerY - 10;

  // Judul Formulir
  const title = 'PERMINTAAN DAN PEMBERIAN CUTI';
  const titleWidth = bold.widthOfTextAtSize(title, 11);
  page.drawText(title, {
    x: left + (contentWidth - titleWidth) / 2,
    y,
    size: 11,
    font: bold,
    color: BLACK,
  });
  y -= 16;

  // I. DATA PEGAWAI
  drawSectionHeader('I. DATA PEGAWAI');
  const rowHeight = 15;
  const col1 = 65;
  const col2 = 195;
  const col3 = 65;

  // Row 1: Nama & NIP
  page.drawRectangle({ x: left, y: y - rowHeight, width: contentWidth, height: rowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + col1, y }, end: { x: left + col1, y: y - rowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + col1 + col2, y }, end: { x: left + col1 + col2, y: y - rowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + col1 + col2 + col3, y }, end: { x: left + col1 + col2 + col3, y: y - rowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('Nama', { x: left + 4, y: y - rowHeight + 4, size: 8, font });
  page.drawText(String(data.name || '-'), { x: left + col1 + 4, y: y - rowHeight + 4, size: 8, font: bold });
  page.drawText('NIP', { x: left + col1 + col2 + 4, y: y - rowHeight + 4, size: 8, font });
  page.drawText(String(data.nip || '-'), { x: left + col1 + col2 + col3 + 4, y: y - rowHeight + 4, size: 8, font: bold });
  y -= rowHeight;

  // Row 2: Jabatan & Pangkat/Gol
  page.drawRectangle({ x: left, y: y - rowHeight, width: contentWidth, height: rowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + col1, y }, end: { x: left + col1, y: y - rowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + col1 + col2, y }, end: { x: left + col1 + col2, y: y - rowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + col1 + col2 + col3, y }, end: { x: left + col1 + col2 + col3, y: y - rowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('Jabatan', { x: left + 4, y: y - rowHeight + 4, size: 8, font });
  page.drawText(String(data.position || '-'), { x: left + col1 + 4, y: y - rowHeight + 4, size: 8, font });
  page.drawText('Golongan', { x: left + col1 + col2 + 4, y: y - rowHeight + 4, size: 8, font });
  page.drawText(formatGradeRank(data.grade), { x: left + col1 + col2 + col3 + 4, y: y - rowHeight + 4, size: 8, font });
  y -= rowHeight;

  // Row 3: Unit Kerja
  page.drawRectangle({ x: left, y: y - rowHeight, width: contentWidth, height: rowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + col1, y }, end: { x: left + col1, y: y - rowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('Unit Kerja', { x: left + 4, y: y - rowHeight + 4, size: 8, font });
  page.drawText(String(data.organization || data.instance_name || 'Kantor Kementerian Agama Kab. Sleman'), {
    x: left + col1 + 4,
    y: y - rowHeight + 4,
    size: 8,
    font,
  });
  y -= rowHeight + 6;

  // II. JENIS CUTI YANG DIAMBIL**
  drawSectionHeader('II. JENIS CUTI YANG DIAMBIL**');
  const halfCol = contentWidth / 2;
  const isType = (t: string) => (data.leave_type || '').toLowerCase().includes(t.toLowerCase());
  const leaveTypesList = [
    { name: '1. Cuti Tahunan', active: isType('Tahunan'), alt: '2. Cuti Besar', altActive: isType('Besar') },
    { name: '3. Cuti Sakit', active: isType('Sakit'), alt: '4. Cuti Melahirkan', altActive: isType('Melahirkan') },
    { name: '5. Cuti Karena Alasan Penting', active: isType('Penting'), alt: '6. Cuti di Luar Tanggungan Negara', altActive: isType('Luar') },
  ];
  for (const row of leaveTypesList) {
    page.drawRectangle({ x: left, y: y - 13, width: contentWidth, height: 13, borderColor: LINE_COLOR, borderWidth: 0.6 });
    page.drawLine({ start: { x: left + halfCol - 30, y }, end: { x: left + halfCol - 30, y: y - 13 }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + halfCol, y }, end: { x: left + halfCol, y: y - 13 }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + contentWidth - 30, y }, end: { x: left + contentWidth - 30, y: y - 13 }, color: LINE_COLOR, thickness: 0.6 });

    page.drawText(row.name, { x: left + 4, y: y - 13 + 3.5, size: 8, font });
    page.drawText(row.active ? 'V' : '-', { x: left + halfCol - 18, y: y - 13 + 3.5, size: 8, font: bold });
    page.drawText(row.alt, { x: left + halfCol + 4, y: y - 13 + 3.5, size: 8, font });
    page.drawText(row.altActive ? 'V' : '-', { x: left + contentWidth - 18, y: y - 13 + 3.5, size: 8, font: bold });
    y -= 13;
  }
  y -= 6;

  // III. ALASAN CUTI
  drawSectionHeader('III. ALASAN CUTI');
  page.drawRectangle({ x: left, y: y - 18, width: contentWidth, height: 18, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawText(data.reason || 'Keperluan keluarga', { x: left + 5, y: y - 18 + 5, size: 8, font });
  y -= 24;

  // IV. LAMANYA CUTI**
  drawSectionHeader('IV. LAMANYA CUTI**');
  page.drawRectangle({ x: left, y: y - 15, width: contentWidth, height: 15, borderColor: LINE_COLOR, borderWidth: 0.6 });
  const durUnit = data.duration_unit === 'day' ? 'Hari' : data.duration_unit === 'month' ? 'Bulan' : 'Tahun';
  const ivText = `Selama : ${data.duration} ${durUnit}      Mulai tanggal : ${formatIndoDate(data.start_date)}      s/d      ${formatIndoDate(data.end_date)}`;
  page.drawText(ivText, { x: left + 10, y: y - 15 + 4, size: 8, font });
  y -= 21;

  // V. CATATAN CUTI***
  drawSectionHeader('V. CATATAN CUTI***');
  const vLeftWidth = 230;
  const vRowHeight = 12;

  // Subheader
  page.drawRectangle({ x: left, y: y - vRowHeight, width: contentWidth, height: vRowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + vLeftWidth, y }, end: { x: left + vLeftWidth, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('1. CUTI TAHUNAN', { x: left + 4, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('2. CUTI BESAR', { x: left + vLeftWidth + 4, y: y - vRowHeight + 3, size: 7.5, font: bold });
  y -= vRowHeight;

  // Headers: Tahun | Sisa | Keterangan
  page.drawRectangle({ x: left, y: y - vRowHeight, width: contentWidth, height: vRowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + 45, y }, end: { x: left + 45, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + 75, y }, end: { x: left + 75, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + vLeftWidth, y }, end: { x: left + vLeftWidth, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + contentWidth - 60, y }, end: { x: left + contentWidth - 60, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('Tahun', { x: left + 8, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('Sisa', { x: left + 50, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('Keterangan', { x: left + 80, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('3. CUTI SAKIT', { x: left + vLeftWidth + 4, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('-', { x: left + contentWidth - 35, y: y - vRowHeight + 3, size: 7.5, font });
  y -= vRowHeight;

  // Row N-2
  page.drawRectangle({ x: left, y: y - vRowHeight, width: contentWidth, height: vRowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + 45, y }, end: { x: left + 45, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + 75, y }, end: { x: left + 75, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + vLeftWidth, y }, end: { x: left + vLeftWidth, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + contentWidth - 60, y }, end: { x: left + contentWidth - 60, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('N-2', { x: left + 10, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText(String(data.quota_n2 ?? 0), { x: left + 55, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText('-', { x: left + 85, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText('4. CUTI MELAHIRKAN', { x: left + vLeftWidth + 4, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('-', { x: left + contentWidth - 35, y: y - vRowHeight + 3, size: 7.5, font });
  y -= vRowHeight;

  // Row N-1
  page.drawRectangle({ x: left, y: y - vRowHeight, width: contentWidth, height: vRowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + 45, y }, end: { x: left + 45, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + 75, y }, end: { x: left + 75, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + vLeftWidth, y }, end: { x: left + vLeftWidth, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + contentWidth - 60, y }, end: { x: left + contentWidth - 60, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('N-1', { x: left + 10, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText(String(data.quota_n1 ?? 0), { x: left + 55, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText('-', { x: left + 85, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText('5. CUTI ALASAN PENTING', { x: left + vLeftWidth + 4, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('-', { x: left + contentWidth - 35, y: y - vRowHeight + 3, size: 7.5, font });
  y -= vRowHeight;

  // Row N
  page.drawRectangle({ x: left, y: y - vRowHeight, width: contentWidth, height: vRowHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + 45, y }, end: { x: left + 45, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + 75, y }, end: { x: left + 75, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + vLeftWidth, y }, end: { x: left + vLeftWidth, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawLine({ start: { x: left + contentWidth - 60, y }, end: { x: left + contentWidth - 60, y: y - vRowHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText('N', { x: left + 14, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText(String(data.quota_n ?? 12), { x: left + 53, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText(`Sisa ${data.quota_n ?? 12} hari`, { x: left + 80, y: y - vRowHeight + 3, size: 7.5, font });
  page.drawText('6. CLTN', { x: left + vLeftWidth + 4, y: y - vRowHeight + 3, size: 7.5, font: bold });
  page.drawText('-', { x: left + contentWidth - 35, y: y - vRowHeight + 3, size: 7.5, font });
  y -= vRowHeight + 6;

  // Generate QR for applicant verification
  const qrPng = await QRCode.toBuffer(`SEDAKEP-CUTI:${data.nip || data.name}`, { margin: 1, width: 100 });
  const qrImage = await doc.embedPng(qrPng);

  // VI. ALAMAT SELAMA MENJALANKAN CUTI
  drawSectionHeader('VI. ALAMAT SELAMA MENJALANKAN CUTI');
  const viHeight = 65;
  const viSplit = 325;
  page.drawRectangle({ x: left, y: y - viHeight, width: contentWidth, height: viHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
  page.drawLine({ start: { x: left + viSplit, y }, end: { x: left + viSplit, y: y - viHeight }, color: LINE_COLOR, thickness: 0.6 });
  page.drawText(`Alamat: ${data.address || '-'}`, { x: left + 5, y: y - 14, size: 8, font, maxWidth: viSplit - 10 });
  page.drawText(`TELP  : ${data.phone || '-'}`, { x: left + 5, y: y - 28, size: 8, font });

  // Right: Pemohon
  page.drawText('Hormat saya,', { x: left + viSplit + 40, y: y - 12, size: 8, font });
  page.drawImage(qrImage, { x: left + viSplit + 50, y: y - 48, width: 32, height: 32 });
  page.drawText(String(data.name || '-'), { x: left + viSplit + 15, y: y - 56, size: 7.5, font: bold });
  page.drawText(`NIP. ${data.nip || '-'}`, { x: left + viSplit + 15, y: y - 64, size: 7.5, font });
  y -= viHeight + 6;

  // VII & VIII (Approvals helper)
  const drawApprovalSection = (
    secTitle: string,
    roleTitle: string,
    approverName: string,
    approverNip: string,
  ) => {
    drawSectionHeader(secTitle);
    const boxHeight = 65;
    const splitX = 325;
    const optH = 12;
    page.drawRectangle({ x: left, y: y - optH, width: contentWidth, height: optH, borderColor: LINE_COLOR, borderWidth: 0.6 });
    page.drawLine({ start: { x: left + 80, y }, end: { x: left + 80, y: y - optH }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + 160, y }, end: { x: left + 160, y: y - optH }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + 250, y }, end: { x: left + 250, y: y - optH }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + splitX, y }, end: { x: left + splitX, y: y - optH }, color: LINE_COLOR, thickness: 0.6 });

    page.drawText('DISETUJUI', { x: left + 15, y: y - optH + 3, size: 7.5, font: bold });
    page.drawText('PERUBAHAN', { x: left + 90, y: y - optH + 3, size: 7.5, font: bold });
    page.drawText('DITANGGUHKAN', { x: left + 170, y: y - optH + 3, size: 7.5, font: bold });
    page.drawText('TIDAK DISETUJUI', { x: left + 255, y: y - optH + 3, size: 7.5, font: bold });
    y -= optH;

    // Checkmark row
    const checkH = 11;
    page.drawRectangle({ x: left, y: y - checkH, width: contentWidth, height: checkH, borderColor: LINE_COLOR, borderWidth: 0.6 });
    page.drawLine({ start: { x: left + 80, y }, end: { x: left + 80, y: y - checkH }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + 160, y }, end: { x: left + 160, y: y - checkH }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + 250, y }, end: { x: left + 250, y: y - checkH }, color: LINE_COLOR, thickness: 0.6 });
    page.drawLine({ start: { x: left + splitX, y }, end: { x: left + splitX, y: y - checkH }, color: LINE_COLOR, thickness: 0.6 });
    page.drawText('V', { x: left + 40, y: y - checkH + 2.5, size: 8, font: bold });
    y -= checkH;

    // Signature box
    page.drawRectangle({ x: left, y: y - boxHeight, width: contentWidth, height: boxHeight, borderColor: LINE_COLOR, borderWidth: 0.6 });
    page.drawLine({ start: { x: left + splitX, y }, end: { x: left + splitX, y: y - boxHeight }, color: LINE_COLOR, thickness: 0.6 });

    page.drawText(roleTitle, { x: left + splitX + 15, y: y - 10, size: 7.5, font });
    page.drawImage(qrImage, { x: left + splitX + 50, y: y - 44, width: 30, height: 30 });
    page.drawText(approverName, { x: left + splitX + 15, y: y - 52, size: 7.5, font: bold });
    page.drawText(`NIP. ${approverNip}`, { x: left + splitX + 15, y: y - 60, size: 7.5, font });
    y -= boxHeight + 6;
  };

  // VII. PERTIMBANGAN ATASAN LANGSUNG
  drawApprovalSection(
    `VII. PERTIMBANGAN ATASAN LANGSUNG [ ${data.approver_1_position || 'Atasan Langsung'} ]**`,
    `${data.approver_1_position || 'Atasan Langsung'},`,
    data.approver_1_name || 'H. Sangaji, S.Ag',
    data.approver_1_nip || '197001011995031001',
  );

  // VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI
  drawApprovalSection(
    `VIII. KEPUTUSAN PEJABAT YANG BERWENANG MEMBERIKAN CUTI [ ${data.approver_2_position || 'Kepala Kantor'} ]**`,
    `${data.approver_2_position || 'Kepala Kantor Kementerian Agama'},`,
    data.approver_2_name || 'Sidik Pramono, S.Ag, M.Si',
    data.approver_2_nip || '196805121994031002',
  );

  // Footnote
  const footerLines = [
    'Catatan: * Coret yang tidak perlu | ** Pilih salah satu dengan memberi tanda centang ( V )',
    '*** diisi oleh pejabat yang menangani bidang kepegawaian sebelum PNS mengajukan cuti | **** diberi tanda centang dan alasannya',
    'N = Cuti tahun berjalan | N-1 = Sisa cuti 1 tahun sebelumnya | N-2 = Sisa cuti 2 tahun sebelumnya',
    'Dokumen ini sah dan ditandatangani secara elektronik melalui SEDAKEP PTSP Kemenag Sleman (https://sleman.kemenag.go.id/sedakep)',
  ];
  let footY = y;
  for (const line of footerLines) {
    page.drawText(line, { x: left, y: footY, size: 6.5, font, color: rgb(0.3, 0.3, 0.3) });
    footY -= 8;
  }

  return doc.save();
};

/**
 * Surat Keterangan (SK) Cuti Resmi Kemenag Sleman
 * Format resmi dengan Kop Logo Kemenag, nomor B-xxx/Kk.12.04/1/Kp.08.2/MM/YYYY,
 * pangkat terurai, rincian hak cuti, QR verifikasi dan penanda tangan.
 */
export const buildLeaveLetterOfficialPdf = async (
  data: OfficialLeaveLetterData,
): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  doc.setTitle(`SK Cuti - ${data.number}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage(F4);

  const left = 55;
  const contentWidth = F4[0] - left * 2;
  let y = F4[1] - 45;

  const BLACK = rgb(0, 0, 0);

  // Logo Kemenag
  const logoFile = Bun.file('assets/logo_kemenag.jpg');
  if (await logoFile.exists()) {
    const logoBytes = Buffer.from(await logoFile.arrayBuffer());
    const logoImg = await doc.embedJpg(logoBytes);
    page.drawImage(logoImg, {
      x: left,
      y: y - 56,
      width: 58,
      height: 56,
    });
  }

  // Kop Kemenag text
  const kopText = (text: string, size: number, isBold: boolean, offsetDown: number) => {
    const f = isBold ? bold : font;
    const w = f.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: left + 65 + (contentWidth - 65 - w) / 2,
      y,
      size,
      font: f,
      color: BLACK,
    });
    y -= offsetDown;
  };

  kopText('KEMENTERIAN AGAMA REPUBLIK INDONESIA', 13, true, 15);
  kopText('KANTOR KEMENTERIAN AGAMA KABUPATEN SLEMAN', 11, true, 13);
  kopText(data.instance_address || 'Jalan Dr. Radjimin, Sleman, Daerah Istimewa Yogyakarta 55511', 8.5, false, 11);
  kopText('Telpon (0274) 868314, Faksimile (0274) 869675', 8.5, false, 11);
  kopText('Situs: sleman.kemenag.go.id', 8.5, false, 10);

  // Double separator line
  y -= 4;
  page.drawLine({ start: { x: left, y }, end: { x: left + contentWidth, y }, thickness: 2, color: BLACK });
  y -= 2.5;
  page.drawLine({ start: { x: left, y }, end: { x: left + contentWidth, y }, thickness: 0.6, color: BLACK });
  y -= 22;

  // Judul: SURAT KETERANGAN CUTI
  const title = 'SURAT KETERANGAN CUTI';
  const tWidth = bold.widthOfTextAtSize(title, 12);
  page.drawText(title, { x: left + (contentWidth - tWidth) / 2, y, size: 12, font: bold, color: BLACK });
  y -= 14;

  const number = `NOMOR : ${data.number}`;
  const nWidth = font.widthOfTextAtSize(number, 11);
  page.drawText(number, { x: left + (contentWidth - nWidth) / 2, y, size: 11, font, color: BLACK });
  y -= 24;

  // 1. Diberikan ...
  page.drawText('1.', { x: left, y, size: 11, font, color: BLACK });
  page.drawText(`Diberikan ${data.leave_type || 'Cuti Tahunan'} kepada Pegawai Negeri Sipil :`, {
    x: left + 18,
    y,
    size: 11,
    font,
    color: BLACK,
  });
  y -= 18;

  // Data Pegawai indent
  const drawRow = (label: string, value: string) => {
    page.drawText(label, { x: left + 40, y, size: 11, font, color: BLACK });
    page.drawText(':', { x: left + 170, y, size: 11, font, color: BLACK });
    page.drawText(value, { x: left + 180, y, size: 11, font: bold, color: BLACK });
    y -= 18;
  };

  drawRow('Nama', data.name || '-');
  drawRow('NIP', data.nip || '-');
  drawRow('Pangkat/Gol. Ruang', formatGradeRank(data.grade));
  drawRow('Jabatan', data.position || '-');

  // Satuan Organisasi
  page.drawText('Satuan Organisasi', { x: left + 40, y, size: 11, font, color: BLACK });
  page.drawText(':', { x: left + 170, y, size: 11, font, color: BLACK });
  page.drawText(data.organization || data.instance_name || 'Kantor Kementerian Agama Kab. Sleman', {
    x: left + 180,
    y,
    size: 11,
    font: bold,
    color: BLACK,
  });
  y -= 24;

  // Selama ...
  const durUnit = data.duration_unit === 'day' ? 'Hari Kerja' : data.duration_unit === 'month' ? 'Bulan' : 'Tahun';
  const bodyText1 = `Selama ${data.duration} ${durUnit}, terhitung mulai tanggal : ${formatIndoDate(data.start_date)} sampai dengan tanggal : ${formatIndoDate(data.end_date)} dengan ketentuan sebagai berikut :`;
  page.drawText(bodyText1, {
    x: left + 18,
    y,
    size: 10.5,
    font,
    color: BLACK,
    maxWidth: contentWidth - 20,
    lineHeight: 16,
  });
  y -= 36;

  // a. Sebelum menjalankan cuti
  page.drawText('a.', { x: left + 25, y, size: 10.5, font, color: BLACK });
  page.drawText(
    'Sebelum menjalankan cuti wajib menyerahkan pekerjaannya kepada atasan langsungnya atau pejabat lain yang ditunjuk.',
    { x: left + 45, y, size: 10.5, font, color: BLACK, maxWidth: contentWidth - 45, lineHeight: 15 },
  );
  y -= 32;

  // b. Setelah selesai menjalankan cuti
  page.drawText('b.', { x: left + 25, y, size: 10.5, font, color: BLACK });
  page.drawText(
    'Setelah selesai menjalankan cuti wajib melaporkan diri kepada atasan langsungnya dan bekerja kembali.',
    { x: left + 45, y, size: 10.5, font, color: BLACK, maxWidth: contentWidth - 45, lineHeight: 15 },
  );
  y -= 32;

  // 2. Demikian Surat Keterangan Cuti ini...
  page.drawText('2.', { x: left, y, size: 11, font, color: BLACK });
  page.drawText(
    'Demikian Surat Keterangan Cuti ini dibuat untuk dapat dipergunakan sebagaimana mestinya.',
    { x: left + 18, y, size: 10.5, font, color: BLACK, maxWidth: contentWidth - 20, lineHeight: 15 },
  );
  y -= 45;

  // Tanda tangan
  const signX = left + contentWidth - 190;
  const issueDate = data.issued_at || data.start_date || new Date().toISOString();
  page.drawText(`Sleman, ${formatIndoDate(issueDate)}`, { x: signX, y, size: 11, font, color: BLACK });
  y -= 16;
  page.drawText(data.official_position || 'Kepala,', { x: signX, y, size: 11, font, color: BLACK });
  y -= 14;

  if (data.verify_url) {
    const qrBuf = await QRCode.toBuffer(data.verify_url, { margin: 1, width: 120 });
    const qrImg = await doc.embedPng(qrBuf);
    page.drawImage(qrImg, { x: signX + 20, y: y - 55, width: 55, height: 55 });
    page.drawText('Ditandatangani secara elektronik', { x: signX - 10, y: y - 66, size: 7.5, font, color: rgb(0.3, 0.3, 0.3) });
    y -= 80;
  } else {
    y -= 60;
  }

  page.drawText(data.official_name || 'Sidik Pramono, S.Ag, M.Si', { x: signX, y, size: 11, font: bold, color: BLACK });

  return doc.save();
};

