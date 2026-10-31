/**
 * Penomoran Surat Keterangan Cuti.
 *
 * Legacy mencetak nomor sebagai `{urut}/Kk.12.04/1/Kp.08.2/{bulan}/{tahun}`
 * (`cetak_sk_pdf.php`), sedangkan kolom `tbl_suket.nomor` hanya menyimpan
 * angka urutnya. Rewrite menyimpan nomor lengkap di satu kolom varchar, jadi
 * dua hal dijaga di sini:
 *
 *  1. Penerbitan baru membentuk nomor lengkap sejak awal.
 *  2. Baris hasil migrasi yang masih berisi angka mentah dinormalkan saat
 *     dicetak, supaya SK lama tidak kehilangan kode kantor dan bulannya.
 */

/** Kode satuan kerja pada nomor SK Kemenag Sleman. */
export const SK_NUMBER_CODE = 'Kk.12.04/1/Kp.08.2';

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

/** Bulan & tahun cetak diambil dari tanggal terbit (fallback: hari ini). */
const monthYear = (issuedAt: string | null | undefined): { month: string; year: string } => {
  const iso = String(issuedAt ?? '').slice(0, 10);
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match && match[1] && match[2]) return { month: match[2], year: match[1] };
  const now = new Date();
  return {
    month: MONTHS[now.getMonth()] ?? '01',
    year: String(now.getFullYear()),
  };
};

/** Nomor lengkap dari angka urut + tanggal terbit. */
export const buildLetterNumber = (
  sequence: number,
  issuedAt: string | null | undefined,
  code: string = SK_NUMBER_CODE,
): string => {
  const { month, year } = monthYear(issuedAt);
  return `${sequence}/${code}/${month}/${year}`;
};

/**
 * Nomor siap cetak.
 *
 * Nomor yang sudah mengandung '/' dianggap lengkap dan dibiarkan apa adanya.
 * Nomor yang masih berupa angka mentah (hasil migrasi `tbl_suket.nomor`)
 * dibentuk ulang memakai tanggal terbitnya.
 */
export const normalizeLetterNumber = (
  number: string | number | null | undefined,
  issuedAt: string | null | undefined,
  code: string = SK_NUMBER_CODE,
): string => {
  const raw = String(number ?? '').trim();
  if (!raw) return '-';
  if (raw.includes('/')) return raw;
  const sequence = Number(raw);
  if (!Number.isInteger(sequence) || sequence <= 0) return raw;
  return buildLetterNumber(sequence, issuedAt, code);
};

/** Nomor urut dari nomor lengkap; dipakai untuk menyelaraskan counter. */
export const sequenceOf = (number: string | null | undefined): number | null => {
  const raw = String(number ?? '').trim();
  if (!raw) return null;
  const head = raw.includes('/') ? raw.split('/')[0] : raw;
  const value = Number(head);
  return Number.isInteger(value) && value > 0 ? value : null;
};

/** Pola nomor lengkap; dipakai test untuk memastikan format legacy terjaga. */
export const LETTER_NUMBER_PATTERN = /^\d+\/Kk\.12\.04\/1\/Kp\.08\.2\/\d{2}\/\d{4}$/;
