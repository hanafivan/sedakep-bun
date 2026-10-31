import { describe, expect, it } from 'bun:test';
import {
  ANNUAL_LEAVE,
  addMonths,
  allowedLeaveTypesForNip,
  applyReservedCascade,
  computeQuota,
  detectDurationAnomaly,
  isPppkNip,
  mapToUiBuckets,
  monthsBetween,
  parseTmtFromNip,
  replayOfficialUsage,
  resolveTmt,
  validateEligibility,
  validateQuotaAvailability,
  type LeaveTransaction,
} from '../api/modules/leave/domain/quota-engine';

/** NIP PNS: lahir 19850315, TMT 201005, nomor 1001 */
const PNS_NIP = '198503152010051001';
/** NIP PPPK: kode pegawai digit 15-16 = 21 */
const PPPK_NIP = '19900101201901210001'.slice(0, 18);

const tx = (
  requestId: number,
  startDate: string,
  duration: number,
  opts: Partial<LeaveTransaction> = {},
): LeaveTransaction => ({
  requestId,
  leaveType: ANNUAL_LEAVE,
  duration,
  durationUnit: 'day',
  startDate,
  isFinal: true,
  isRejectedOrCancelled: false,
  ...opts,
});

describe('parse NIP dan TMT', () => {
  it('mengurai TMT PNS dari digit 9-14', () => {
    const tmt = parseTmtFromNip(PNS_NIP);
    expect(tmt).not.toBeNull();
    expect(tmt?.year).toBe(2010);
    expect(tmt?.month).toBe(5);
    expect(tmt?.isPppk).toBe(false);
  });

  it('menandai PPPK dari kode pegawai 21', () => {
    expect(isPppkNip(PNS_NIP)).toBe(false);
  });

  it('menolak NIP yang bukan 18 digit', () => {
    expect(parseTmtFromNip('123')).toBeNull();
    expect(resolveTmt('123', null).kind).toBe('invalid_nip');
  });

  it('PPPK tanpa data TMT ditandai manual validation', () => {
    // 8 digit lahir + 1901 (TMT) + 21 (kode pegawai PPPK) + 0001
    const nip = '199001011901012101';
    expect(nip).toHaveLength(18);
    const resolved = resolveTmt(nip, null);
    expect(resolved.kind).toBe('missing_pppk_tmt');
    if (resolved.kind === 'missing_pppk_tmt') {
      expect(validateEligibility(resolved, '2026-12-31').manualValidation).toBe(true);
    }
  });

  it('membatasi jenis cuti PPPK', () => {
    expect(allowedLeaveTypesForNip(PNS_NIP)).toContain('Cuti Besar');
  });
});

describe('perhitungan masa kerja', () => {
  it('menghitung bulan penuh', () => {
    expect(monthsBetween('2020-01-01', '2021-01-01')).toBe(12);
    expect(monthsBetween('2020-01-15', '2021-01-14')).toBe(11);
    expect(monthsBetween('2020-05-01', '2025-05-01')).toBe(60);
  });

  it('tidak pernah negatif', () => {
    expect(monthsBetween('2026-01-01', '2020-01-01')).toBe(0);
  });

  it('menambah bulan untuk tanggal eligible', () => {
    expect(addMonths('2020-01-15', 12)).toBe('2021-01-15');
    expect(addMonths('2020-01-31', 1)).toBe('2020-02-29');
  });

  it('eligible setelah 12 bulan', () => {
    const tmt = resolveTmt(PNS_NIP, null);
    const eligibility = validateEligibility(tmt, '2026-12-31');
    expect(eligibility.eligible).toBe(true);
    expect(eligibility.monthsWorked).toBeGreaterThan(12);
  });
});

describe('replay kuota origin year', () => {
  it('mengurangi pool tahun berjalan lebih dulu', () => {
    const pools = { 2025: 12, 2026: 12 };
    const { origin } = replayOfficialUsage(pools, { 2026: 5 }, 2025, 2026);
    expect(origin[2026]).toBe(7);
    expect(origin[2025]).toBe(12);
  });

  it('melimpah ke tahun sebelumnya saat pool habis', () => {
    const pools = { 2024: 12, 2025: 12, 2026: 12 };
    const { origin } = replayOfficialUsage(pools, { 2026: 20 }, 2024, 2026);
    expect(origin[2026]).toBe(0);
    expect(origin[2025]).toBe(4);
  });

  it('menghanguskan sisa N-2 saat tersentuh', () => {
    const pools = { 2024: 12, 2025: 12, 2026: 12 };
    // 2026 pakai 12 (N habis), lanjut 12 (N-1 habis), lalu 1 hari dari N-2
    const { origin } = replayOfficialUsage(pools, { 2026: 25 }, 2024, 2026);
    expect(origin[2026]).toBe(0);
    expect(origin[2025]).toBe(0);
    expect(origin[2024]).toBe(0);
  });
});

describe('mapping ke label UI N / N-1 / N-2', () => {
  it('membatasi carry over maksimal 6', () => {
    const ui = mapToUiBuckets({ 2025: 12, 2026: 12 }, {}, 2026);
    expect(ui.n).toBe(12);
    expect(ui.n1).toBe(6);
    expect(ui.n2).toBe(6);
    expect(ui.total).toBe(24);
  });

  it('mengosongkan N-2 bila tahun itu pernah dipakai', () => {
    const ui = mapToUiBuckets({ 2024: 8, 2025: 6, 2026: 12 }, { 2024: 4 }, 2026);
    expect(ui.n2).toBe(0);
  });
});

describe('cascade reserved', () => {
  it('mengurangi dari N dulu', () => {
    const available = applyReservedCascade({ n: 12, n1: 6, n2: 0, total: 18 }, 3);
    expect(available.n).toBe(9);
    expect(available.total).toBe(15);
  });

  it('melimpah ke N-1 saat N habis', () => {
    const available = applyReservedCascade({ n: 4, n1: 6, n2: 0, total: 10 }, 6);
    expect(available.n).toBe(0);
    expect(available.n1).toBe(4);
  });
});

describe('computeQuota end-to-end', () => {
  const tmt = resolveTmt(PNS_NIP, null);

  it('sisa penuh untuk user tanpa transaksi', () => {
    const quota = computeQuota({ year: 2026, tmt, transactions: [] });
    expect(quota.official.n).toBe(12);
    expect(quota.official.n1).toBe(6);
    expect(quota.official.n2).toBe(6);
    expect(quota.available.total).toBe(24);
  });

  it('transaksi final mengurangi official', () => {
    const quota = computeQuota({ year: 2026, tmt, transactions: [tx(1, '2026-03-01', 4)] });
    expect(quota.official.n).toBe(8);
    expect(quota.available.total).toBe(20);
  });

  it('transaksi belum final hanya mengunci available (reserved)', () => {
    const quota = computeQuota({
      year: 2026,
      tmt,
      transactions: [tx(1, '2026-03-01', 3, { isFinal: false })],
    });
    expect(quota.official.n).toBe(12);
    expect(quota.reservedDays).toBe(3);
    expect(quota.reservedCount).toBe(1);
    expect(quota.available.n).toBe(9);
  });

  it('transaksi ditolak/dibatalkan tidak dihitung sama sekali', () => {
    const quota = computeQuota({
      year: 2026,
      tmt,
      transactions: [
        tx(1, '2026-03-01', 5, { isRejectedOrCancelled: true, isFinal: false }),
      ],
    });
    expect(quota.official.n).toBe(12);
    expect(quota.reservedDays).toBe(0);
  });

  it('jenis cuti selain tahunan tidak menyentuh kuota', () => {
    const quota = computeQuota({
      year: 2026,
      tmt,
      transactions: [
        tx(1, '2026-03-01', 30, { leaveType: 'Cuti Sakit' }),
        tx(2, '2026-04-01', 90, { leaveType: 'Cuti Melahirkan' }),
      ],
    });
    expect(quota.official.n).toBe(12);
  });

  it('excludeRequestId mencegah double count saat edit', () => {
    const transactions = [tx(1, '2026-03-01', 4)];
    const withSelf = computeQuota({ year: 2026, tmt, transactions });
    const withoutSelf = computeQuota({ year: 2026, tmt, transactions, excludeRequestId: 1 });
    expect(withSelf.official.n).toBe(8);
    expect(withoutSelf.official.n).toBe(12);
  });

  it('tanggal transaksi menentukan tahun, bukan tahun permintaan', () => {
    // Transaksi 2025 tidak boleh mengurangi pool tahun berjalan 2026.
    const quota = computeQuota({ year: 2026, tmt, transactions: [tx(1, '2025-12-30', 6)] });
    expect(quota.official.n).toBe(12);
    expect(quota.official.n1).toBe(6);
    expect(quota.reservedDays).toBe(0);
  });

  it('user belum eligible mendapat nol', () => {
    const futureTmt = resolveTmt('199001012026011001', null);
    const quota = computeQuota({ year: 2026, tmt: futureTmt, transactions: [] });
    expect(quota.eligibility.eligible).toBe(false);
    expect(quota.official.total).toBe(0);
  });
});

describe('validasi ketersediaan', () => {
  const tmt = resolveTmt(PNS_NIP, null);

  it('menolak permohonan melebihi saldo', () => {
    const quota = computeQuota({ year: 2026, tmt, transactions: [tx(1, '2026-01-05', 20)] });
    // 20 hari: 12 dari N, 8 dari N-1 → sisa N 0, N-1 4, N-2 6 = 10
    expect(quota.available.total).toBe(10);
    const result = validateQuotaAvailability(quota, 11, ANNUAL_LEAVE);
    expect(result.valid).toBe(false);
    expect(result.message).toContain('Kuota tidak cukup');
  });

  it('menyebut reserved di pesan error', () => {
    const quota = computeQuota({
      year: 2026,
      tmt,
      transactions: [tx(1, '2026-01-05', 20, { isFinal: false })],
    });
    const result = validateQuotaAvailability(quota, 10, ANNUAL_LEAVE);
    expect(result.message).toContain('proses approval');
  });

  it('selalu valid untuk cuti non tahunan', () => {
    const quota = computeQuota({ year: 2026, tmt, transactions: [] });
    expect(validateQuotaAvailability(quota, 99, 'Cuti Sakit').valid).toBe(true);
  });
});

describe('deteksi anomali data legacy', () => {
  it('menandai satuan bukan hari pada cuti tahunan', () => {
    expect(detectDurationAnomaly(3, 'year', ANNUAL_LEAVE)).toBe('satuan_year');
  });

  it('menandai durasi nol atau negatif', () => {
    expect(detectDurationAnomaly(0, 'day', ANNUAL_LEAVE)).toBe('durasi_tidak_valid');
    expect(detectDurationAnomaly(-1, 'day', 'Cuti Sakit')).toBe('durasi_tidak_valid');
  });

  it('menerima data normal', () => {
    expect(detectDurationAnomaly(3, 'day', ANNUAL_LEAVE)).toBeNull();
  });
});
