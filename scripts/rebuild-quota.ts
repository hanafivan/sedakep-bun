#!/usr/bin/env bun
/**
 * Rebuild projection `leave_quotas` dari histori `leave_requests`.
 *
 *   bun run quota:rebuild --year 2026
 *   bun run quota:rebuild --year 2019-2026
 *   bun run quota:rebuild --user 5 --year 2026
 *   bun run quota:rebuild --year 2026 --dry-run
 *
 * Idempotent: hasil hanya bergantung pada histori request, bukan pada nilai
 * projection sebelumnya. Aman dipanggil ulang kapan saja.
 */
import { closeMySql, getMySql } from '../api/db/mysql';
import { getAllActiveUserIds } from '../api/modules/leave/query';
import { rebuildQuota } from '../api/modules/leave/service/quota.service';

const args = process.argv.slice(2);
const valueOf = (flag: string): string | undefined => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const dryRun = args.includes('--dry-run');

const years: number[] = [];
const yearArg = valueOf('--year');
if (yearArg) {
  if (yearArg.includes('-')) {
    const [from, to] = yearArg.split('-').map(Number) as [number, number];
    for (let year = from; year <= to; year += 1) years.push(year);
  } else {
    years.push(Number(yearArg));
  }
} else {
  const current = new Date().getFullYear();
  for (let year = current - 2; year <= current; year += 1) years.push(year);
}

const userArg = valueOf('--user');

const main = async (): Promise<void> => {
  const userIds = userArg ? [Number(userArg)] : await getAllActiveUserIds();

  console.log(`Years : ${years.join(', ')}`);
  console.log(`Users : ${userIds.length}`);
  console.log(`Mode  : ${dryRun ? 'dry-run' : 'apply'}\n`);

  if (dryRun) {
    const [count] = await getMySql().query(
      'SELECT COUNT(*) AS total FROM leave_requests',
    );
    console.log(`(dry-run) akan menghitung ${(count as Array<{ total: number }>)[0]?.total} permohonan.`);
    return;
  }

  let success = 0;
  const errors: string[] = [];

  for (const year of years) {
    for (const userId of userIds) {
      try {
        await rebuildQuota(userId, year, null);
        success += 1;
      } catch (error) {
        errors.push(`user ${userId} year ${year}: ${(error as Error).message}`);
      }
    }
    process.stdout.write(`\r  tahun ${year}: ${success} projection selesai`);
  }
  process.stdout.write('\n');

  console.log(`\n${success} projection berhasil, ${errors.length} gagal.`);
  for (const error of errors.slice(0, 20)) console.log(`  ! ${error}`);

  const [summary] = await getMySql().query(
    `SELECT
       COUNT(*) AS rows_total,
       SUM(eligible = 1) AS eligible,
       SUM(manual_validation = 1) AS manual_validation,
       SUM(total_remaining > 0) AS with_balance
     FROM leave_quotas`,
  );
  console.log('\nRingkasan leave_quotas:', JSON.stringify(summary));
};

await main();
await closeMySql();
