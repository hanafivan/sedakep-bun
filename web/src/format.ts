/** Pemformat tampilan — dipakai bersama supaya angka & tanggal konsisten. */

export const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-';
  const iso = String(value).slice(0, 10);
  const [year, month, day] = iso.split('-');
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
};

export const formatBytes = (bytes: number | null | undefined): string => {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const labelStatus: Record<string, string> = {
  submitted: 'Diajukan',
  in_review: 'Diproses',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  cancelled: 'Dibatalkan',
  pending: 'Menunggu',
  accepted: 'Diterima',
};

/**
 * Status permohonan untuk tampilan.
 *
 * `in_review` sengaja TIDAK pernah ditampilkan sebagai "Disetujui" — status
 * ini berarti masih ada tahap approval yang belum selesai.
 */
export const leaveStatusLabel = (status: string): string =>
  labelStatus[status] ?? status;

/** Kelas warna; dipakai CSS, bukan warna inline. */
export const leaveStatusTone = (status: string | null | undefined): string => {
  if (!status) return 'badge muted';
  if (status === 'approved' || status === 'accepted') return 'badge ok';
  if (status === 'rejected') return 'badge bad';
  if (status === 'cancelled') return 'badge muted';
  if (status === 'in_review' || status === 'pending') return 'badge warn';
  return 'badge';
};

export const decisionLabel = (value: string): string => labelStatus[value] ?? value;

export const totalDays = (bucket: { n: number; n1: number; n2: number }): number =>
  bucket.n + bucket.n1 + bucket.n2;

const durationUnitLabels: Record<string, string> = {
  day: 'hari',
  month: 'bulan',
  year: 'tahun',
};

export const durationUnitLabel = (unit: string | null | undefined): string =>
  unit ? durationUnitLabels[unit] ?? unit : '-';

const gradeLabels: Record<string, string> = {
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
  IX: 'Ahli Pertama, IX',
  X: 'Ahli Muda, X',
  XI: 'Ahli Madya, XI',
  VII: 'Terampil, VII',
};

export const gradeLabel = (grade: string | null | undefined): string =>
  grade ? (gradeLabels[grade] ?? grade) : '-';

/**
 * Format masa kerja: dibulatkan ke tahun terdekat kemudian disisakan bulan,
 * misal: "17 Tahun 9 Bulan", "1 Tahun", atau "8 Bulan".
 */
export const formatMasaKerja = (
  val: number | string | null | undefined,
  nip?: string | null,
  startDate?: string | null,
): string => {
  if (val && typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return '-';
    // Format "X Tahun Y Bulan"
    const matchYearMonth = trimmed.match(/^(\d+)\s*(?:tahun|thn|th)\s*(?:(\d+)\s*(?:bulan|bln))?$/i);
    if (matchYearMonth && matchYearMonth[1]) {
      const y = parseInt(matchYearMonth[1], 10);
      const m = matchYearMonth[2] ? parseInt(matchYearMonth[2], 10) : 0;
      if (y > 0 && m > 0) return `${y} Tahun ${m} Bulan`;
      if (y > 0) return `${y} Tahun`;
      return `${m} Bulan`;
    }
    if (trimmed.toLowerCase().includes('tahun')) return trimmed;

    const parsed = parseInt(trimmed.replace(/\D/g, ''), 10);
    if (!isNaN(parsed)) {
      const years = Math.floor(parsed / 12);
      const months = parsed % 12;
      if (years > 0 && months > 0) return `${years} Tahun ${months} Bulan`;
      if (years > 0) return `${years} Tahun`;
      return `${months} Bulan`;
    }
  }

  let num: number | null = typeof val === 'number' ? val : null;
  if (num === null && nip) {
    const clean = String(nip).replace(/\D/g, '');
    if (clean.length === 18) {
      const year = parseInt(clean.slice(8, 12), 10);
      const month = parseInt(clean.slice(12, 14), 10);
      if (year >= 1950 && year <= 2050 && month >= 1 && month <= 12) {
        const ref = startDate ? new Date(`${String(startDate).slice(0, 10)}T00:00:00Z`) : new Date();
        const diffYears = ref.getUTCFullYear() - year;
        const diffMonths = (ref.getUTCMonth() + 1) - month;
        num = Math.max(0, diffYears * 12 + diffMonths);
      }
    }
  }

  if (num === null || num < 0) return typeof val === 'string' && val ? val : '-';
  const years = Math.floor(num / 12);
  const months = num % 12;
  if (years > 0 && months > 0) return `${years} Tahun ${months} Bulan`;
  if (years > 0) return `${years} Tahun`;
  return `${months} Bulan`;
};
