/**
 * Engine kuota cuti tahunan — PURE, tanpa akses database.
 *
 * Mempertahankan perilaku engine legacy terbaru (calculateOriginYearQuota):
 * bekerja dengan konsep pool per origin year (tahun transaksi), lalu
 * memetakannya ke tampilan N / N-1 / N-2.
 *
 * N / N-1 / N-2 hanyalah label UI:
 *   N   = pool tahun target
 *   N-1 = pool tahun target-1, maksimal 6 hari
 *   N-2 = pool tahun target-2, maksimal 6 hari, hangus bila tersentuh
 */

export const ANNUAL_LEAVE = 'Cuti Tahunan';
export const LARGE_LEAVE_TYPE = 'Cuti Besar';
export const MAX_CARRY_OVER = 6;
export const DEFAULT_QUOTA = 12;
export const MIN_SERVICE_MONTHS = 12;

export const ANNUAL_LEAVE_TYPES = [
  'Cuti Tahunan',
  'Cuti Sakit',
  'Cuti Alasan Penting',
  'Cuti Besar',
  'Cuti Melahirkan',
  'Cuti Di Luar Tanggungan Negara',
] as const;

/** PPPK hanya boleh tiga jenis cuti (aturan legacy). */
export const PPPK_LEAVE_TYPES = ['Cuti Tahunan', 'Cuti Sakit', 'Cuti Melahirkan'] as const;

export type LeaveType = (typeof ANNUAL_LEAVE_TYPES)[number] | string;

export type TmtInfo = {
  year: number;
  month: number;
  isPppk: boolean;
  isSpecialMonthCode: boolean;
};

export type ResolvedTmt =
  | { kind: 'pns'; date: string; year: number; month: number }
  | { kind: 'pppk'; date: string; year: number; month: number }
  | { kind: 'missing_pppk_tmt'; year: number; month: number }
  | { kind: 'invalid_nip' };

export type EligibilityResult = {
  eligible: boolean;
  reason: string;
  monthsWorked: number;
  tmtYear: number | null;
  tmtMonth: number | null;
  isPppk: boolean;
  manualValidation: boolean;
  eligibleDate: string | null;
};

/** Hasil perhitungan kuota yang dipakai API dan projection. */
export type QuotaComputation = {
  year: number;
  official: { n: number; n1: number; n2: number; total: number };
  reservedDays: number;
  reservedCount: number;
  available: { n: number; n1: number; n2: number; total: number };
  eligibility: EligibilityResult;
  origin: Record<number, number>;
  /** Cuti Besar final di tahun ini menghanguskan jatah tahun berjalan. */
  largeLeaveApplied: boolean;
  /** Hari Cuti Besar yang diakui (dipakai laporan). */
  largeLeaveDays: number;
};

export type LeaveTransaction = {
  requestId: number;
  leaveType: LeaveType;
  duration: number;
  durationUnit: 'day' | 'month' | 'year';
  startDate: string;
  isFinal: boolean;
  isRejectedOrCancelled: boolean;
};

export type QuotaEngineInput = {
  year: number;
  tmt: ResolvedTmt;
  minimumServiceMonths?: number;
  carryOverMaxN1?: number;
  carryOverMaxN2?: number;
  dailyQuota?: number;
  /** Semua transaksi cuti milik user; engine yang memfilter. */
  transactions: LeaveTransaction[];
  /** Tanggal referensi untuk perhitungan eligibility. */
  referenceDate?: string;
  /** Request yang sedang diedit/diajukan: dikecualikan dari perhitungan. */
  excludeRequestId?: number | null;
  /**
   * Penyesuaian kuota manual admin (boleh negatif).
   * Ditambahkan ke pool tahun berjalan, bukan ditulis ke projection, supaya
   * nilainya bertahan setiap kali projection dihitung ulang dari histori.
   */
  adjustmentDays?: number;
  /**
   * Koreksi manual per bucket (legacy `admin_kuota_user.php` menyunting
   * `kuota_n`, `kuota_n1`, `kuota_n2` sekaligus).
   *
   * Diterapkan setelah pemetaan bucket supaya angka yang diketik admin
   * terpakai apa adanya; kalau dibatasi `carry_over_max`, koreksi 12 hari
   * untuk N-1 akan diam-diam dipotong jadi 6 tanpa penjelasan.
   */
  adjustmentBuckets?: { n?: number; n1?: number; n2?: number } | null;
  /** Admin menyatakan pegawai layak meski masa kerja belum cukup. */
  eligibilityOverride?: { active: boolean; reason?: string | null } | null;
};

const isoDate = (value: string): string => value.slice(0, 10);
const yearOf = (value: string): number => Number(isoDate(value).slice(0, 4));

/** Jumlah bulan penuh antara dua tanggal ISO (YYYY-MM-DD). */
export const monthsBetween = (fromIso: string, toIso: string): number => {
  const from = new Date(`${isoDate(fromIso)}T00:00:00Z`);
  const to = new Date(`${isoDate(toIso)}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  if (to < from) return 0;
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12;
  months += to.getUTCMonth() - from.getUTCMonth();
  if (to.getUTCDate() < from.getUTCDate()) months -= 1;
  return Math.max(0, months);
};

/**
 * Parse TMT dari NIP PNS.
 * Layout: 8 digit tanggal lahir + 6 digit YYYYMM TMT + 4 digit nomor.
 * Kode pegawai digit ke-15/16 = '21' menandai PPPK.
 */
export const parseTmtFromNip = (nip: string): TmtInfo | null => {
  const clean = (nip ?? '').replace(/\D/g, '');
  if (clean.length !== 18) return null;

  const tmtPart = clean.slice(8, 14);
  const year = Number(tmtPart.slice(0, 4));
  const month = Number(tmtPart.slice(4, 6));

  if (!Number.isFinite(year) || year < 1900 || year > 2100) return null;

  const employeeCode = clean.slice(14, 16);
  const isPppk = employeeCode === '21';
  const isSpecialMonthCode = month === 21 || isPppk;

  if (!isSpecialMonthCode && (month < 1 || month > 12)) return null;

  return {
    year,
    month: month === 21 ? 1 : month,
    isPppk,
    isSpecialMonthCode,
  };
};

export const isPppkNip = (nip: string): boolean => parseTmtFromNip(nip)?.isPppk ?? false;

export const allowedLeaveTypesForNip = (nip: string): readonly string[] =>
  isPppkNip(nip) ? PPPK_LEAVE_TYPES : ANNUAL_LEAVE_TYPES;

export const isLeaveTypeAllowedForNip = (nip: string, leaveType: string): boolean =>
  allowedLeaveTypesForNip(nip).includes(leaveType);

/** Resolve TMT: PNS dari NIP, PPPK dari record TMT tersendiri. */
export const resolveTmt = (
  nip: string,
  pppkTmtDate: string | null | undefined,
): ResolvedTmt => {
  const parsed = parseTmtFromNip(nip);
  if (!parsed) return { kind: 'invalid_nip' };

  if (parsed.isPppk) {
    if (!pppkTmtDate) {
      return { kind: 'missing_pppk_tmt', year: parsed.year, month: parsed.month };
    }
    const date = isoDate(pppkTmtDate);
    return {
      kind: 'pppk',
      date,
      year: Number(date.slice(0, 4)),
      month: Number(date.slice(5, 7)),
    };
  }

  const month = String(parsed.month).padStart(2, '0');
  const date = `${parsed.year}-${month}-01`;
  return { kind: 'pns', date, year: parsed.year, month: parsed.month };
};

export const validateEligibility = (
  tmt: ResolvedTmt,
  referenceDate: string,
  minimumServiceMonths = MIN_SERVICE_MONTHS,
): EligibilityResult => {
  const base = {
    tmtYear: null as number | null,
    tmtMonth: null as number | null,
    manualValidation: false,
    eligibleDate: null as string | null,
  };

  if (tmt.kind === 'invalid_nip') {
    return {
      ...base,
      eligible: false,
      reason: 'Format NIP tidak valid.',
      monthsWorked: 0,
      isPppk: false,
      manualValidation: true,
    };
  }

  if (tmt.kind === 'missing_pppk_tmt') {
    return {
      ...base,
      tmtYear: tmt.year,
      tmtMonth: tmt.month,
      eligible: false,
      reason: 'TMT PPPK belum terdaftar.',
      monthsWorked: 0,
      isPppk: true,
      manualValidation: true,
    };
  }

  const monthsWorked = monthsBetween(tmt.date, referenceDate);
  const eligible = monthsWorked >= minimumServiceMonths;
  const eligibleDate = addMonths(tmt.date, minimumServiceMonths);

  return {
    eligible,
    reason: eligible
      ? `Memenuhi syarat masa kerja minimal ${minimumServiceMonths} bulan`
      : `Belum memenuhi masa kerja minimal ${minimumServiceMonths} bulan.`,
    monthsWorked,
    tmtYear: tmt.year,
    tmtMonth: tmt.month,
    isPppk: tmt.kind === 'pppk',
    manualValidation: false,
    eligibleDate,
  };
};

export const addMonths = (iso: string, months: number): string => {
  const date = new Date(`${isoDate(iso)}T00:00:00Z`);
  const day = date.getUTCDate();
  date.setUTCMonth(date.getUTCMonth() + months);
  // Menjaga tanggal 31 tidak melompat ke bulan berikutnya.
  if (date.getUTCDate() < day) date.setUTCDate(0);
  return date.toISOString().slice(0, 10);
};

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

/** Hanya Cuti Tahunan final yang mengonsumsi kuota resmi. */
const isOfficialQuotaTransaction = (tx: LeaveTransaction, excludeId?: number | null): boolean =>
  tx.leaveType === ANNUAL_LEAVE &&
  tx.isFinal &&
  !tx.isRejectedOrCancelled &&
  (excludeId == null || tx.requestId !== excludeId);

/** Request yang dicadangkan: belum final dan tidak ditolak. */
const isReservedTransaction = (tx: LeaveTransaction, year: number, excludeId?: number | null): boolean =>
  tx.leaveType === ANNUAL_LEAVE &&
  !tx.isRejectedOrCancelled &&
  !tx.isFinal &&
  yearOf(tx.startDate) === year &&
  (excludeId == null || tx.requestId !== excludeId);

/**
 * Bangun pool per origin year.
 * Setiap tahun yang sudah eligible memiliki kuota penuh.
 */
export const buildOriginPools = (
  tmt: ResolvedTmt,
  fromYear: number,
  toYear: number,
  dailyQuota: number,
  minimumServiceMonths: number,
): Record<number, number> => {
  const pools: Record<number, number> = {};
  for (let year = fromYear; year <= toYear; year += 1) {
    const reference = year === toYear ? `${year}-12-31` : `${year}-12-31`;
    const eligibility = validateEligibility(tmt, reference, minimumServiceMonths);
    pools[year] = eligibility.eligible ? dailyQuota : 0;
  }
  return pools;
};

export type ReplayResult = {
  origin: Record<number, number>;
  everUsed: Record<number, boolean>;
};

/**
 * Replay penggunaan resmi: setiap transaksi tahun Y mengurangi pool
 * Y, lalu Y-1, lalu Y-2. Bila pool Y-2 tersentuh, sisanya hangus.
 */
export const replayOfficialUsage = (
  pools: Record<number, number>,
  usageByYear: Record<number, number>,
  fromYear: number,
  toYear: number,
  carryOverMaxN2 = MAX_CARRY_OVER,
): ReplayResult => {
  const origin: Record<number, number> = { ...pools };
  const everUsed: Record<number, boolean> = {};
  for (let y = fromYear; y <= toYear; y += 1) everUsed[y] = false;

  for (let year = fromYear; year <= toYear; year += 1) {
    const used = usageByYear[year] ?? 0;
    if (used <= 0) continue;

    let remaining = used;
    for (const bucket of [year, year - 1, year - 2]) {
      if (remaining <= 0) break;
      const available = origin[bucket];
      if (available === undefined || available <= 0) continue;

      const take = Math.min(remaining, available);
      origin[bucket] = available - take;
      remaining -= take;
      everUsed[bucket] = true;

      // Aturan legacy: sekali pool N-2 tersentuh, sisanya hangus.
      if (bucket === year - 2 && take > 0) {
        origin[bucket] = 0;
        break;
      }
    }
  }

  void carryOverMaxN2;
  return { origin, everUsed };
};

/** Peta pool origin ke label UI N / N-1 / N-2. */
export const mapToUiBuckets = (
  origin: Record<number, number>,
  usageByYear: Record<number, number>,
  year: number,
  carryOverMaxN1 = MAX_CARRY_OVER,
  carryOverMaxN2 = MAX_CARRY_OVER,
): { n: number; n1: number; n2: number; total: number } => {
  const n = origin[year] ?? DEFAULT_QUOTA;
  const n1Raw = origin[year - 1] ?? DEFAULT_QUOTA;
  const n2Raw = origin[year - 2] ?? DEFAULT_QUOTA;

  const n1 = Math.min(carryOverMaxN1, Math.max(0, n1Raw));

  const n2WasUsed = (usageByYear[year - 2] ?? 0) > 0;
  let n2 = n2WasUsed ? 0 : Math.min(carryOverMaxN2, Math.max(0, n2Raw));
  if (!n2WasUsed && n2Raw === 0 && origin[year - 2] === 0) n2 = 0;

  return { n, n1, n2, total: n + n1 + n2 };
};

/** Cadangan: available = official, lalu dikurangi reserved dengan cascade. */
export const applyReservedCascade = (
  official: { n: number; n1: number; n2: number; total: number },
  reservedDays: number,
  carryOverMax = MAX_CARRY_OVER,
): { n: number; n1: number; n2: number; total: number } => {
  let remaining = Math.max(0, reservedDays);

  const n = Math.max(0, official.n - remaining);
  if (remaining > official.n) {
    remaining -= official.n;
  } else {
    remaining = 0;
  }

  const n1 = Math.max(0, official.n1 - remaining);
  if (remaining > official.n1) {
    remaining -= official.n1;
  } else {
    remaining = 0;
  }

  const n2 = Math.max(0, official.n2 - remaining);

  const cappedN1 = Math.min(carryOverMax, n1);
  const cappedN2 = Math.min(carryOverMax, n2);

  return { n, n1: cappedN1, n2: cappedN2, total: n + cappedN1 + cappedN2 };
};

/**
 * Perhitungan utama. Tidak menyentuh database sama sekali.
 */
export const computeQuota = (input: QuotaEngineInput): QuotaComputation => {
  const {
    year,
    tmt,
    transactions,
    excludeRequestId = null,
    referenceDate = `${year}-12-31`,
    minimumServiceMonths = MIN_SERVICE_MONTHS,
    carryOverMaxN1 = MAX_CARRY_OVER,
    carryOverMaxN2 = MAX_CARRY_OVER,
    dailyQuota = DEFAULT_QUOTA,
    adjustmentDays = 0,
    adjustmentBuckets = null,
    eligibilityOverride = null,
  } = input;

  const baseEligibility = validateEligibility(tmt, referenceDate, minimumServiceMonths);

  // Admin boleh menyatakan layak meski masa kerja belum cukup atau TMT PPPK
  // belum terdaftar. Penanda manual_validation tetap dibawa ke respons supaya
  // terlihat bahwa keputusan ini hasil override, bukan perhitungan otomatis.
  const eligibility: EligibilityResult = eligibilityOverride?.active
    ? {
        ...baseEligibility,
        eligible: true,
        manualValidation: true,
        reason: eligibilityOverride.reason
          ? `Divalidasi manual oleh admin: ${eligibilityOverride.reason}`
          : 'Divalidasi manual oleh admin.',
      }
    : baseEligibility;

  const empty = { n: 0, n1: 0, n2: 0, total: 0 };
  if (!eligibility.eligible) {
    return {
      year,
      official: empty,
      reservedDays: 0,
      reservedCount: 0,
      available: empty,
      eligibility,
      origin: {},
      largeLeaveApplied: false,
      largeLeaveDays: 0,
    };
  }

  const usageByYear: Record<number, number> = {};
  let reservedDays = 0;
  let reservedCount = 0;
  let largeLeaveApplied = false;
  let largeLeaveDays = 0;

  for (const tx of transactions) {
    if (isOfficialQuotaTransaction(tx, excludeRequestId)) {
      const txYear = yearOf(tx.startDate);
      usageByYear[txYear] = (usageByYear[txYear] ?? 0) + tx.duration;
      continue;
    }
    if (isReservedTransaction(tx, year, excludeRequestId)) {
      reservedDays += tx.duration;
      reservedCount += 1;
      continue;
    }
    // Cuti Besar: sekali disetujui, jatah tahun berjalan hangus.
    // Pending tidak menghanguskan apa pun — baru berlaku setelah final,
    // supaya pengajuan yang nanti ditolak tidak merusak saldo.
    if (
      tx.leaveType === LARGE_LEAVE_TYPE &&
      tx.isFinal &&
      !tx.isRejectedOrCancelled &&
      yearOf(tx.startDate) === year &&
      (excludeRequestId == null || tx.requestId !== excludeRequestId)
    ) {
      largeLeaveApplied = true;
      largeLeaveDays += tx.duration;
    }
  }

  const usageYears = Object.keys(usageByYear).map(Number).filter((y) => !Number.isNaN(y));
  const earliestUsage = usageYears.length > 0 ? Math.min(...usageYears) : year;
  const fromYear = Math.min(earliestUsage, year - 2);

  const pools = buildOriginPools(tmt, fromYear, year, dailyQuota, minimumServiceMonths);
  const { origin } = replayOfficialUsage(pools, usageByYear, fromYear, year, carryOverMaxN2);

  // Cuti Besar menghanguskan pool tahun berjalan sebelum dipetakan ke label UI,
  // sehingga N = 0 sementara N-1 dan N-2 tetap seperti perhitungan normal.
  if (largeLeaveApplied) origin[year] = 0;

  // Penyesuaian manual admin ditambahkan setelah replay supaya tidak ikut
  // dihanguskan, tapi tetap tunduk pada aturan Cuti Besar di atas.
  if (adjustmentDays !== 0 && !largeLeaveApplied) {
    origin[year] = Math.max(0, (origin[year] ?? 0) + adjustmentDays);
  }

  const official = mapToUiBuckets(origin, usageByYear, year, carryOverMaxN1, carryOverMaxN2);

  // Koreksi per bucket dari admin, setelah cap carry-over. Angka boleh negatif
  // (memotong jatah) tetapi total tidak boleh turun di bawah 0.
  const bucketN = Math.max(0, official.n + (adjustmentBuckets?.n ?? 0));
  const bucketN1 = Math.max(0, official.n1 + (adjustmentBuckets?.n1 ?? 0));
  const bucketN2 = Math.max(0, official.n2 + (adjustmentBuckets?.n2 ?? 0));
  const adjusted = {
    n: bucketN,
    n1: bucketN1,
    n2: bucketN2,
    total: bucketN + bucketN1 + bucketN2,
  };

  const available = applyReservedCascade(adjusted, reservedDays);

  return {
    year,
    official: adjusted,
    reservedDays,
    reservedCount,
    available,
    eligibility,
    origin,
    largeLeaveApplied,
    largeLeaveDays,
  };
};

export type QuotaValidation = {
  valid: boolean;
  available: number;
  needed: number;
  message: string;
};

/** Validasi ketersediaan kuota untuk pengajuan baru/edit. */
export const validateQuotaAvailability = (
  quota: QuotaComputation,
  duration: number,
  leaveType: string,
): QuotaValidation => {
  if (leaveType !== ANNUAL_LEAVE) {
    return { valid: true, available: 0, needed: 0, message: '' };
  }

  if (!quota.eligibility.eligible) {
    return {
      valid: false,
      available: 0,
      needed: duration,
      message: quota.eligibility.reason,
    };
  }

  const available = quota.available.total;
  if (duration <= available) {
    return { valid: true, available, needed: duration, message: '' };
  }

  const reservedNote =
    quota.reservedDays > 0
      ? ` (${quota.reservedDays} hari sedang dalam proses approval)`
      : '';
  return {
    valid: false,
    available,
    needed: duration,
    message: `Kuota tidak cukup. Tersedia: ${available} hari, diajukan: ${duration} hari.${reservedNote}`,
  };
};

/** Deteksi anomali data legacy yang harus dibawa ke laporan migrasi. */
export const detectDurationAnomaly = (
  duration: number,
  durationUnit: string,
  leaveType: string,
): string | null => {
  if (leaveType === ANNUAL_LEAVE && durationUnit !== 'day') {
    return `satuan_${durationUnit}`;
  }
  if (duration <= 0) return 'durasi_tidak_valid';
  if (duration > 366) return 'durasi_tidak_wajar';
  return null;
};
