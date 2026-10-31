#!/usr/bin/env bun
/**
 * Scheduler rollover kuota cuti (Fase penjadwalan).
 *
 *   bun run scheduler                 # loop tiap SCHEDULER_INTERVAL_MINUTES
 *   bun run scheduler --once          # satu sweep lalu keluar (untuk cron)
 *   bun run scheduler --once --dry-run
 *   bun run scheduler --once --force  # abaikan penanda "sudah jalan"
 *
 * Dijalankan sebagai proses terpisah dari API supaya tidak dobel bila API
 * di-scale. Lihat docs/cutover-runbook.md untuk contoh systemd/cron.
 */
import { config } from '../api/config';
import { closeMySql } from '../api/db/mysql';
import { runDueJobs } from '../api/scheduler';

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const valueOf = (name: string): string | undefined => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const dryRun = has('--dry-run');
const force = has('--force');
const once = has('--once');
const intervalMinutes = Math.max(
  Number(valueOf('--interval') ?? config.scheduler.intervalMinutes) || 1,
  1,
);

const sweep = async (): Promise<void> => {
  const now = new Date();
  const result = await runDueJobs({ now, dryRun, force });
  const stamp = now.toISOString();
  if (result.ran.length) console.log(`[${stamp}] dijalankan: ${result.ran.join(', ')}`);
  if (result.skipped.length) console.log(`[${stamp}] dilewati: ${result.skipped.join(', ')}`);
};

const main = async (): Promise<void> => {
  console.log(
    `Scheduler : tz=${config.scheduler.timezone} rollover=${config.scheduler.rolloverMonth}/${config.scheduler.rolloverDay}`,
  );
  console.log(`Mode      : ${once ? 'sekali' : `interval ${intervalMinutes} menit`}${dryRun ? ' (dry-run)' : ''}`);

  await sweep();

  if (once) return;

  const timer = setInterval(() => {
    void sweep().catch((error) => console.error('sweep gagal:', error));
  }, intervalMinutes * 60_000);

  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await closeMySql();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());

  // Tahan proses tetap hidup menunggu sinyal.
  await new Promise(() => {});
};

await main();
if (once) await closeMySql();
