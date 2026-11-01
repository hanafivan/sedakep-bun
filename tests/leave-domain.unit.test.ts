import { describe, expect, it } from 'bun:test';
import {
  ANNUAL_LEAVE_TYPE,
  getLeaveTypeRule,
  knownLeaveTypes,
  LEAVE_TYPE_RULES,
  validateLeaveTypeRules,
} from '../api/modules/leave-requests/domain/leave-types';
import {
  buildLetterNumber,
  LETTER_NUMBER_PATTERN,
  normalizeLetterNumber,
  sequenceOf,
  SK_NUMBER_CODE,
} from '../api/modules/leave-letters/domain/letter-number';

describe('leave-types: aturan jenis cuti (pure unit test)', () => {
  it('mendaftarkan seluruh jenis cuti yang dikenal', () => {
    const types = knownLeaveTypes();
    expect(types).toContain('Cuti Tahunan');
    expect(types).toContain('Cuti Sakit');
    expect(types).toContain('Cuti Alasan Penting');
    expect(types).toContain('Cuti Besar');
    expect(types).toContain('Cuti Melahirkan');
    expect(types).toContain('Cuti Di Luar Tanggungan Negara');
  });

  it('hanya Cuti Tahunan yang mengurangi kuota', () => {
    expect(LEAVE_TYPE_RULES[ANNUAL_LEAVE_TYPE]?.consumesQuota).toBe(true);
    expect(LEAVE_TYPE_RULES['Cuti Sakit']?.consumesQuota).toBe(false);
    expect(LEAVE_TYPE_RULES['Cuti Besar']?.consumesQuota).toBe(false);
    expect(LEAVE_TYPE_RULES['Cuti Melahirkan']?.consumesQuota).toBe(false);
  });

  it('Cuti Besar menyetel kuota tahun berjalan menjadi 0 (zeroesAnnualBucket)', () => {
    expect(LEAVE_TYPE_RULES['Cuti Besar']?.zeroesAnnualBucket).toBe(true);
    expect(LEAVE_TYPE_RULES[ANNUAL_LEAVE_TYPE]?.zeroesAnnualBucket).toBe(false);
  });

  it('mengembalikan rule untuk jenis yang valid dan null untuk jenis tidak dikenal', () => {
    expect(getLeaveTypeRule('Cuti Tahunan')).not.toBeNull();
    expect(getLeaveTypeRule('Cuti Tidak Ada')).toBeNull();
  });

  describe('validasi aturan pengajuan', () => {
    it('menolak jenis cuti yang tidak dikenal', () => {
      const result = validateLeaveTypeRules('Cuti Asing', 1, 'day', false);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('tidak dikenal');
    });

    it('menolak satuan yang tidak diizinkan untuk jenis tersebut', () => {
      const result = validateLeaveTypeRules('Cuti Tahunan', 1, 'year', false);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('tidak memakai satuan "year"');
    });

    it('meloloskan satuan hari untuk cuti tahunan bagi PNS', () => {
      const result = validateLeaveTypeRules('Cuti Tahunan', 3, 'day', false);
      expect(result.valid).toBe(true);
      expect(result.message).toBe('');
    });

    it('membatasi PPPK dari mengajukan Cuti Besar dan Cuti Alasan Penting', () => {
      const besar = validateLeaveTypeRules('Cuti Besar', 30, 'day', true);
      expect(besar.valid).toBe(false);
      expect(besar.message).toContain('tidak dapat diajukan oleh PPPK');

      const penting = validateLeaveTypeRules('Cuti Alasan Penting', 5, 'day', true);
      expect(penting.valid).toBe(false);
      expect(penting.message).toContain('tidak dapat diajukan oleh PPPK');
    });

    it('mengizinkan PPPK untuk Cuti Tahunan, Sakit, dan Melahirkan', () => {
      expect(validateLeaveTypeRules('Cuti Tahunan', 5, 'day', true).valid).toBe(true);
      expect(validateLeaveTypeRules('Cuti Sakit', 2, 'day', true).valid).toBe(true);
      expect(validateLeaveTypeRules('Cuti Melahirkan', 1, 'month', true).valid).toBe(true);
    });

    it('menolak durasi melebihi batas maksimum', () => {
      // Cuti Alasan Penting max 30 hari
      const result = validateLeaveTypeRules('Cuti Alasan Penting', 31, 'day', false);
      expect(result.valid).toBe(false);
      expect(result.message).toContain('paling lama 30 hari');
    });

    it('menghitung batas hari saat memakai satuan bulan (30 hari/bulan)', () => {
      // Cuti Melahirkan max 90 hari = ~3 bulan
      const valid4Bulan = validateLeaveTypeRules('Cuti Melahirkan', 4, 'month', false);
      expect(valid4Bulan.valid).toBe(false);
      expect(valid4Bulan.message).toContain('paling lama 90 hari');

      const valid3Bulan = validateLeaveTypeRules('Cuti Melahirkan', 3, 'month', false);
      expect(valid3Bulan.valid).toBe(true);
    });
  });
});

describe('letter-number: penomoran surat keterangan cuti (pure unit test)', () => {
  it('membentuk nomor lengkap dari nomor urut dan tanggal terbit', () => {
    const number = buildLetterNumber(15, '2026-03-15');
    expect(number).toBe(`15/${SK_NUMBER_CODE}/03/2026`);
  });

  it('memakai tanggal hari ini bila tanggal terbit kosong', () => {
    const number = buildLetterNumber(1, null);
    const yearNow = new Date().getFullYear().toString();
    expect(number).toContain(`1/${SK_NUMBER_CODE}/`);
    expect(number).toContain(yearNow);
  });

  it('menormalkan nomor mentah legacy menjadi format lengkap', () => {
    const normalized = normalizeLetterNumber('42', '2025-11-20');
    expect(normalized).toBe(`42/${SK_NUMBER_CODE}/11/2025`);
  });

  it('membiarkan nomor yang sudah berformat lengkap', () => {
    const existing = '99/CUSTOM.CODE/08/2024';
    expect(normalizeLetterNumber(existing, '2025-01-01')).toBe(existing);
  });

  it('mengembalikan "-" untuk nomor kosong', () => {
    expect(normalizeLetterNumber('', '2026-01-01')).toBe('-');
    expect(normalizeLetterNumber(null, '2026-01-01')).toBe('-');
  });

  it('sequenceOf mengambil angka urut dari nomor lengkap', () => {
    expect(sequenceOf('42/Kk.12.04/1/Kp.08.2/11/2025')).toBe(42);
    expect(sequenceOf('7')).toBe(7);
    expect(sequenceOf('')).toBeNull();
    expect(sequenceOf(null)).toBeNull();
  });

  it('LETTER_NUMBER_PATTERN cocok dengan format surat yang dibangun', () => {
    const formatted = buildLetterNumber(5, '2026-04-10');
    expect(formatted).toMatch(LETTER_NUMBER_PATTERN);
  });
});
