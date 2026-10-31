/**
 * Aturan per jenis cuti — PURE, tanpa akses database.
 *
 * Sumber aturan:
 * - `include/cuti_quota_functions.php` (deductQuota, handleCutiBesar,
 *   allowedLeaveTypesForNip): hanya Cuti Tahunan yang mengurangi kuota;
 *   Cuti Besar menyetel kuota tahun berjalan jadi 0; PPPK hanya tiga jenis.
 * - `tambah_surat_masuk.php`: pembatasan jenis per NIP dan satuan yang boleh dipilih.
 *
 * Batas hari di bawah ini TIDAK ada di legacy (legacy tidak membatasi), jadi
 * dipakai sebagai batas wajar administratif — bukan kutipan peraturan. Kalau
 * Kantor punya angka resmi sendiri, ubah di sini dan seluruh API ikut.
 */

export const ANNUAL_LEAVE_TYPE = 'Cuti Tahunan';
export { LARGE_LEAVE_TYPE } from './quota-engine';

export type LeaveTypeRule = {
  /** Mengurangi kuota cuti tahunan (hanya Cuti Tahunan). */
  consumesQuota: boolean;
  /** Boleh diajukan oleh PPPK. */
  allowedForPppk: boolean;
  /** Satuan yang masuk akal untuk jenis ini. */
  units: readonly ('day' | 'month' | 'year')[];
  /** Batas lama cuti dalam hari (perkiraan; 0 = tidak dibatasi). */
  maxDays: number;
  /** Menghanguskan kuota tahun berjalan setelah disetujui (Cuti Besar). */
  zeroesAnnualBucket: boolean;
  /** Wajib melampirkan dokumen pendukung saat mengajukan. */
  requiresAttachment: boolean;
  /** Kena periode tutup tahunan. */
  subjectToClosure: boolean;
  description: string;
};

const DAY: readonly ('day' | 'month' | 'year')[] = ['day'];

export const LEAVE_TYPE_RULES: Record<string, LeaveTypeRule> = {
  'Cuti Tahunan': {
    consumesQuota: true,
    allowedForPppk: true,
    units: DAY,
    maxDays: 366,
    zeroesAnnualBucket: false,
    requiresAttachment: false,
    subjectToClosure: true,
    description: 'Mengurangi kuota tahunan (N, N-1, N-2).',
  },
  'Cuti Sakit': {
    consumesQuota: false,
    allowedForPppk: true,
    units: DAY,
    maxDays: 366,
    zeroesAnnualBucket: false,
    requiresAttachment: true,
    subjectToClosure: false,
    description: 'Tidak mengurangi kuota tahunan; wajib surat keterangan dokter.',
  },
  'Cuti Alasan Penting': {
    consumesQuota: false,
    allowedForPppk: false,
    units: DAY,
    maxDays: 30,
    zeroesAnnualBucket: false,
    requiresAttachment: true,
    subjectToClosure: false,
    description: 'Alasan penting, paling lama 30 hari.',
  },
  'Cuti Besar': {
    consumesQuota: false,
    allowedForPppk: false,
    units: DAY,
    maxDays: 90,
    zeroesAnnualBucket: true,
    requiresAttachment: false,
    subjectToClosure: false,
    description: 'Menyetel kuota cuti tahunan tahun berjalan menjadi 0 setelah disetujui.',
  },
  'Cuti Melahirkan': {
    consumesQuota: false,
    allowedForPppk: true,
    units: ['day', 'month'],
    maxDays: 90,
    zeroesAnnualBucket: false,
    requiresAttachment: true,
    subjectToClosure: false,
    description: 'Paling lama 3 bulan; wajib keterangan medis.',
  },
  'Cuti Di Luar Tanggungan Negara': {
    consumesQuota: false,
    allowedForPppk: false,
    units: ['day', 'month', 'year'],
    maxDays: 1095,
    zeroesAnnualBucket: false,
    requiresAttachment: true,
    subjectToClosure: false,
    description: 'Cuti di luar tanggungan negara.',
  },
};

export const getLeaveTypeRule = (leaveType: string): LeaveTypeRule | null =>
  LEAVE_TYPE_RULES[leaveType] ?? null;

export const knownLeaveTypes = (): string[] => Object.keys(LEAVE_TYPE_RULES);

/** Validasi aturan jenis cuti untuk satu pengajuan. */
export const validateLeaveTypeRules = (
  leaveType: string,
  duration: number,
  durationUnit: string,
  isPppk: boolean,
): { valid: boolean; message: string } => {
  const rule = getLeaveTypeRule(leaveType);
  if (!rule) {
    return { valid: false, message: `Jenis cuti "${leaveType}" tidak dikenal.` };
  }

  if (!rule.units.includes(durationUnit as 'day' | 'month' | 'year')) {
    return {
      valid: false,
      message: `${leaveType} tidak memakai satuan "${durationUnit}". Gunakan: ${rule.units.join(', ')}.`,
    };
  }

  if (isPppk && !rule.allowedForPppk) {
    return { valid: false, message: `${leaveType} tidak dapat diajukan oleh PPPK.` };
  }

  // Batas hanya berlaku kalau satuannya hari; bulan/tahun dikonversi kasar.
  const asDays =
    durationUnit === 'day' ? duration : durationUnit === 'month' ? duration * 30 : duration * 365;
  if (rule.maxDays > 0 && asDays > rule.maxDays) {
    return {
      valid: false,
      message: `${leaveType} paling lama ${rule.maxDays} hari; diajukan sekitar ${asDays} hari.`,
    };
  }

  return { valid: true, message: '' };
};
