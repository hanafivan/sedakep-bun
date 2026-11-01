import { config } from '../config';
import { insertAuditLog, upsertSettingRow } from '../modules/settings/command';
import { findSettingByKey } from '../modules/settings/query';
import { rolloverYear } from '../modules/leave-quota/domain';

/**
 * Scheduler rollover kuota cuti.
 *
 * Meniru `cron_reset_cuti.php` legacy: setiap awal tahun, projection kuota
 * seluruh pegawai dihitung ulang. Engine sendiri sudah membawa sisa tahun
 * sebelumnya saat dihitung, jadi job ini cukup memanggil `rolloverYear`.
 *
 * Idempotensi dijaga penanda `settings` `scheduler.rollover.{year}` — dijalankan
 * berkali-kali tetap aman, yang kedua dilaporkan `skipped`.
 */

export type SchedulerJobResult = {
  ran: string[];
  skipped: string[];
};

export type RolloverOutcome = 'ran' | 'skipped' | 'dry-run';

/** Tanggal lokal pada zona waktu yang diminta (default Asia/Jakarta). */
export const localDateParts = (
  now: Date,
  timeZone: string,
): { year: number; month: number; day: number } => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { year: get('year'), month: get('month'), day: get('day') };
};

export const rolloverKey = (year: number): string => `scheduler.rollover.${year}`;

export const isRolloverDone = async (year: number): Promise<boolean> => {
  const row = await findSettingByKey(rolloverKey(year));
  return Boolean(row?.value);
};

export const markRolloverDone = async (year: number, summary: unknown): Promise<void> => {
  await upsertSettingRow({
    key: rolloverKey(year),
    value: new Date().toISOString(),
    description: `Rollover tahun ${year} dijalankan scheduler`,
  });
  await insertAuditLog({
    actor_id: null,
    action: 'scheduler_rollover',
    entity_table: 'settings',
    entity_id: null,
    after_data: { year, summary },
  });
};

export const runRolloverJob = async (options: {
  year: number;
  dryRun?: boolean;
  force?: boolean;
}): Promise<RolloverOutcome> => {
  const { year, dryRun = false, force = false } = options;
  if (!force && (await isRolloverDone(year))) return 'skipped';
  if (dryRun) return 'dry-run';
  const result = await rolloverYear(year, null);
  await markRolloverDone(year, { success: result.success, failed: result.failed });
  return 'ran';
};

/** Jalankan semua job yang jatuh tempo pada `now` (default sekarang). */
export const runDueJobs = async (options: {
  now?: Date;
  dryRun?: boolean;
  force?: boolean;
} = {}): Promise<SchedulerJobResult> => {
  const now = options.now ?? new Date();
  const { year, month, day } = localDateParts(now, config.scheduler.timezone);
  const result: SchedulerJobResult = { ran: [], skipped: [] };

  const due =
    month === config.scheduler.rolloverMonth && day === config.scheduler.rolloverDay;
  if (!due) {
    result.skipped.push(
      `rollover (menunggu ${config.scheduler.rolloverMonth}/${config.scheduler.rolloverDay})`,
    );
    return result;
  }

  const outcome = await runRolloverJob({ year, dryRun: options.dryRun, force: options.force });
  if (outcome === 'skipped') {
    result.skipped.push(`rollover ${year}`);
  } else {
    result.ran.push(`rollover ${year}${outcome === 'dry-run' ? ' (dry-run)' : ''}`);
  }
  return result;
};
