#!/usr/bin/env bun
/**
 * Migrasi data dari database legacy `ptsp_sedakep` ke database target `sedakep`.
 *
 *   bun run migrate:legacy --all
 *   bun run migrate:legacy --users
 *   bun run migrate:legacy --leave
 *   bun run migrate:legacy --policy
 *   bun run migrate:legacy --tmt
 *   bun run migrate:legacy --letters
 *   bun run migrate:legacy --legacy-history
 *   bun run migrate:legacy --dry-run --all
 *   bun run migrate:legacy --report
 *
 * Sifat: idempotent dan resumable. Baris yang sudah tercatat di `legacy_mappings`
 * atau `migration_items` (status verified) dilewati, jadi aman dijalankan ulang
 * walau data legacy bertambah saat migrasi berlangsung.
 */
import { config } from '../api/config';
import { closeMySql, getMySql } from '../api/db/mysql';
import { closeLegacyMySql } from '../api/db/legacy-mysql';
import { ensureDatabase, runMigrations } from '../api/db/migrate';
import {
  leaveMigrationSummary,
  migrateLeaveClosurePeriods,
  migrateLeaveLegacyHistory,
  migrateLeaveLetters,
  migrateLeavePolicies,
  migrateLeaveRequests,
  migratePppkTmt,
  migrateUsers,
} from '../api/migrate';

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const dryRun = has('--dry-run');
const runAll = has('--all') || args.length === 0;

const startRun = async (scope: string): Promise<number> => {
  const [result] = await getMySql().query(
    'INSERT INTO migration_runs (scope) VALUES (?)',
    [scope],
  );
  return Number((result as unknown as { insertId: number }).insertId);
};

const finishRun = async (
  id: number,
  counters: { read?: number; written?: number; skipped?: number; failed?: number },
  payload: unknown,
): Promise<void> => {
  await getMySql().query(
    `UPDATE migration_runs
        SET finished_at = NOW(), read_count = ?, written = ?, skipped = ?, failed = ?, payload = ?
      WHERE id = ?`,
    [
      counters.read ?? 0,
      counters.written ?? 0,
      counters.skipped ?? 0,
      counters.failed ?? 0,
      JSON.stringify(payload),
      id,
    ],
  );
};

const line = (label: string, value: unknown) =>
  console.log(`  ${label.padEnd(22)}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);

const main = async (): Promise<void> => {
  console.log(`Target : ${config.mysql.database} @ ${config.mysql.host}:${config.mysql.port}`);
  console.log(`Legacy : ${config.legacyMysql.database} @ ${config.legacyMysql.host}:${config.legacyMysql.port}`);
  console.log(`Mode   : ${dryRun ? 'dry-run' : 'apply'}\n`);

  if (!dryRun) {
    await ensureDatabase();
    await runMigrations({ ensureDb: false });
  }

  if (has('--report')) {
    const summary = await leaveMigrationSummary();
    console.log('Ringkasan rekonsiliasi cuti:');
    line('permohonan legacy', summary.legacyRequests);
    line('permohonan target', summary.targetRequests);
    line('selisih', summary.legacyRequests - summary.targetRequests);
    line('tbl_acc legacy', summary.legacyAcc);
    line('tbl_acc orphan', summary.orphanAcc);
    line('anomali satuan', summary.anomalyUnit);
    line('anomali durasi', summary.anomalyDuration);
    line('gagal tanpa map', summary.missingMapping);
    return;
  }

  if (runAll || has('--users')) {
    console.log('== master (organizations, positions, users) ==');
    const runId = dryRun ? 0 : await startRun('users');
    const counters = await migrateUsers(dryRun);
    line('organizations', counters.organizations);
    line('positions', counters.positions);
    line('users baru', counters.users);
    line('users dilewati', counters.skippedUsers);
    if (!dryRun) await finishRun(runId, { written: counters.users, skipped: counters.skippedUsers }, counters);
  }

  if (runAll || has('--policy')) {
    console.log('\n== policy kuota (tbl_cuti_settings) ==');
    const count = await migrateLeavePolicies(dryRun);
    line('baris policy', count);
    const closures = await migrateLeaveClosurePeriods(dryRun);
    line('periode tutup', closures);
  }

  if (runAll || has('--tmt')) {
    console.log('\n== TMT PPPK (tbl_pppk_tmt) ==');
    const result = await migratePppkTmt(dryRun);
    line('user diperbarui', result.updated);
    line('tanpa padanan', result.unmatched);
  }

  if (runAll || has('--leave')) {
    console.log('\n== permohonan cuti (tbl_surat_masuk + tbl_acc) ==');
    const runId = dryRun ? 0 : await startRun('leave_requests');
    const counters = await migrateLeaveRequests({
      dryRun,
      onProgress: (done, total) => {
        process.stdout.write(`\r  progres: ${done}/${total}`);
      },
    });
    process.stdout.write('\r');
    line('dibaca', counters.read);
    line('ditulis', counters.inserted);
    line('dilewati (sudah ada)', counters.skipped);
    line('user tanpa mapping', counters.unmappedUser);
    line('anomali satuan', counters.anomalyUnit);
    line('anomali durasi', counters.anomalyDuration);
    line('tbl_acc orphan', counters.orphanAcc);
    line('tbl_acc duplikat', counters.duplicateAcc);
    if (!dryRun) {
      await finishRun(
        runId,
        {
          read: counters.read,
          written: counters.inserted,
          skipped: counters.skipped,
          failed: counters.unmappedUser,
        },
        counters,
      );
    }
  }

  if (runAll || has('--letters')) {
    console.log('\n== surat keterangan cuti (tbl_suket + tbl_suketmad) ==');
    const runId = dryRun ? 0 : await startRun('leave_letters');
    const counters = await migrateLeaveLetters({
      dryRun,
      onProgress: (done, total) => {
        process.stdout.write(`\r  progres: ${done}/${total}`);
      },
    });
    line('suket dibaca', counters.suketRead);
    line('suket ditulis', counters.suketInserted);
    line('suket dilewati (sudah ada)', counters.suketSkipped);
    line('suket tanpa permohonan', counters.suketUnmatched);
    line('suket duplikat (id_surat)', counters.suketDuplicates);
    line('suketmad dibaca', counters.suketmadRead);
    line('suketmad ditulis', counters.suketmadInserted);
    line('suketmad dilewati', counters.suketmadSkipped);
    line('suketmad tanpa permohonan', counters.suketmadUnmatched);
    line('suketmad duplikat', counters.suketmadDuplicates);
    line('counter disinkronkan', counters.countersSynced);
    if (!dryRun) {
      await finishRun(
        runId,
        {
          read: counters.suketRead + counters.suketmadRead,
          written: counters.suketInserted + counters.suketmadInserted,
          skipped: counters.suketSkipped + counters.suketmadSkipped,
          failed: counters.suketUnmatched + counters.suketmadUnmatched,
        },
        counters,
      );
    }
  }

  if (runAll || has('--legacy-history')) {
    console.log('\n== riwayat cuti 2019 (tbl_n2019) ==');
    const runId = dryRun ? 0 : await startRun('leave_legacy_history');
    const counters = await migrateLeaveLegacyHistory({
      dryRun,
      onProgress: (done, total) => {
        process.stdout.write(`\r  progres: ${done}/${total}`);
      },
    });
    process.stdout.write('\r');
    line('dibaca', counters.read);
    line('ditulis', counters.inserted);
    line('dilewati (sudah ada)', counters.skipped);
    line('NIP tanpa user', counters.unmatchedUser);
    line('tanggal tidak valid', counters.invalidDate);
    line('durasi tidak valid', counters.invalidDuration);
    if (!dryRun) {
      await finishRun(
        runId,
        {
          read: counters.read,
          written: counters.inserted,
          skipped: counters.skipped,
          failed: counters.unmatchedUser,
        },
        counters,
      );
    }
  }
};


await main();
await closeMySql();
await closeLegacyMySql();
