import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { config } from '../api/config';
import { getMySql } from '../api/db/mysql';
import {
  isRolloverDone,
  localDateParts,
  markRolloverDone,
  runDueJobs,
  runRolloverJob,
} from '../api/scheduler';
import { assertTestDatabase, describeDb } from './helpers/db';

/**
 * Scheduler rollover: tanggal lokal Asia/Jakarta, penanda idempoten, dry-run.
 * Job memakai `year` 209x agar tidak menyentuh projection data nyata.
 */

describe('scheduler: tanggal lokal', () => {
  it('memakai zona waktu yang diminta, bukan UTC', () => {
    // 31 Des 2025 18:00 UTC = 1 Jan 2026 01:00 WIB.
    expect(localDateParts(new Date('2025-12-31T18:00:00Z'), 'Asia/Jakarta')).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
    // UTC tetap 31 Des.
    expect(localDateParts(new Date('2025-12-31T18:00:00Z'), 'UTC')).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });
});

describeDb('scheduler: job rollover', () => {
  const { rolloverMonth, rolloverDay } = config.scheduler;
  /** Tengah hari UTC supaya tetap tanggal yang sama di hampir semua zona. */
  const onRolloverDay = (year: number) =>
    new Date(Date.UTC(year, rolloverMonth - 1, rolloverDay, 12, 0, 0));

  beforeAll(async () => {
    assertTestDatabase();
    await getMySql().query("DELETE FROM settings WHERE `key` LIKE 'scheduler.rollover.209%'");
  });

  afterAll(async () => {
    await getMySql().query("DELETE FROM settings WHERE `key` LIKE 'scheduler.rollover.209%'");
  });

  it('dry-run pada tanggal jatuh tempo tidak menulis penanda', async () => {
    const result = await runDueJobs({ now: onRolloverDay(2098), dryRun: true });
    expect(result.ran.length).toBe(1);
    expect(await isRolloverDone(2098)).toBe(false);
  });

  it('idempoten: menjalankan dua kali, yang kedua dilewati', async () => {
    expect(await runRolloverJob({ year: 2097, force: true })).toBe('ran');
    expect(await isRolloverDone(2097)).toBe(true);
    expect(await runRolloverJob({ year: 2097 })).toBe('skipped');
  });

  it('tidak jalan di luar tanggal jatuh tempo', async () => {
    const mismatchMonth = rolloverMonth === 7 ? 8 : 7;
    const now = new Date(Date.UTC(2096, mismatchMonth - 1, 1, 12, 0, 0));
    const result = await runDueJobs({ now });
    expect(result.ran).toEqual([]);
    expect(result.skipped.length).toBeGreaterThan(0);
  });

  it('markRolloverDone mencatat penanda', async () => {
    await markRolloverDone(2095, { success: 0, failed: 0 });
    expect(await isRolloverDone(2095)).toBe(true);
  });
});
