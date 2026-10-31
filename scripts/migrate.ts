#!/usr/bin/env bun
/**
 * Runner migrasi skema database target.
 *
 *   bun run migrate              # terapkan semua migrasi yang belum jalan
 *   bun run migrate --dry-run    # tampilkan rencana tanpa eksekusi
 *   bun run migrate --status     # status + deteksi drift checksum
 */
import { closeMySql } from '../api/db/mysql';
import { migrationStatus, runMigrations } from '../api/db/migrate';
import { config } from '../api/config';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const statusOnly = args.includes('--status');

console.log(`Database : ${config.mysql.database} @ ${config.mysql.host}:${config.mysql.port}`);

if (statusOnly) {
  const status = await migrationStatus('app');
  console.log('Mode     : status\n');
  for (const row of status) {
    const mark = !row.applied ? 'belum' : row.drifted ? 'DRIFT' : 'ok   ';
    console.log(`  [${mark}] ${row.file}`);
  }
  const pending = status.filter((row) => !row.applied).length;
  const drifted = status.filter((row) => row.drifted).length;
  console.log(`\n${status.length} migrasi, ${pending} belum diterapkan, ${drifted} drift.`);
} else {
  const result = await runMigrations({ dryRun });
  console.log(`Mode     : ${dryRun ? 'dry-run' : 'apply'}\n`);
  for (const file of result.applied) {
    console.log(`  ${dryRun ? '~' : '+'} ${file}`);
  }
  for (const file of result.skipped) console.log(`  = ${file} (sudah ada)`);
  for (const file of result.drifted) console.log(`  ! ${file} (checksum berubah)`);
  console.log(
    `\n${result.applied.length} diterapkan, ${result.skipped.length} dilewati, ${result.drifted.length} drift.`,
  );
}

await closeMySql();
