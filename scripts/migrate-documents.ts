#!/usr/bin/env bun
/**
 * Migrasi dokumen legacy (filesystem XAMPP) → MinIO.
 *
 *   bun run migrate:documents --dry-run
 *   bun run migrate:documents               # jalan dari checkpoint
 *   bun run migrate:documents --retry-failed
 *   bun run migrate:documents --verify
 *   bun run migrate:documents --final-scan
 *   bun run migrate:documents --table tbl_surat_masuk
 *   bun run migrate:documents --report
 *
 * Idempotent: identity `(source_table, source_column, source_record_id)` di
 * `migration_items` mencegah object dibuat dua kali. File sumber tidak dihapus.
 */
import { closeMySql, getMySql } from '../api/db/mysql';
import { closeLegacyMySql } from '../api/db/legacy-mysql';
import {
  documentMigrationSummary,
  migrateDocuments,
} from '../api/migrate/documents';
import { DOCUMENT_SOURCES, legacyFileRoot } from '../api/migrate/document-sources';
import { closeS3 } from '../api/shared/storage-client';

const args = process.argv.slice(2);
const has = (flag: string) => args.includes(flag);
const valueOf = (flag: string) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const formatBytes = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 2)} ${units[unit]}`;
};

const main = async (): Promise<void> => {
  if (has('--report')) {
    const summary = await documentMigrationSummary();
    console.log('Status migrasi dokumen:');
    for (const [status, total] of Object.entries(summary.byStatus)) {
      console.log(`  ${status.padEnd(18)}: ${total}`);
    }
    console.log(`  ${'total bytes'.padEnd(18)}: ${formatBytes(summary.totalBytes)} (${summary.totalBytes})`);
    return;
  }

  if (has('--scan')) {
    console.log('Sumber dokumen yang terdaftar:');
    for (const source of DOCUMENT_SOURCES) {
      console.log(`  ${source.table}.${source.column} → ${legacyFileRoot(source.directory)}`);
    }
    return;
  }

  const dryRun = has('--dry-run');
  const retryFailed = has('--retry-failed');
  const verifyOnly = has('--verify');
  const onlyTable = valueOf('--table');

  console.log('Mode   : ' + (dryRun ? 'dry-run' : verifyOnly ? 'verify' : retryFailed ? 'retry-failed' : 'apply'));
  console.log('Sumber : ' + DOCUMENT_SOURCES.length + ' kolom file di 19 tabel legacy');
  if (onlyTable) console.log('Tabel  : ' + onlyTable);
  console.log('');

  const counters = await migrateDocuments({
    dryRun,
    retryFailed,
    verifyOnly,
    onlyTable,
    onProgress: (label, done, total) => {
      if (done % 50 === 0 || done === total) {
        process.stdout.write(`\r  ${label}: ${done}/${total}          `);
      }
    },
  });

  console.log('\nHasil:');
  console.log(`  ${'dipindai'.padEnd(18)}: ${counters.scanned}`);
  console.log(`  ${'diunggah'.padEnd(18)}: ${counters.uploaded}`);
  console.log(`  ${'dipakai ulang'.padEnd(18)}: ${counters.reused}`);
  console.log(`  ${'file hilang'.padEnd(18)}: ${counters.skippedMissing}`);
  console.log(`  ${'entitas belum ada'.padEnd(18)}: ${counters.skippedUnmapped}`);
  console.log(`  ${'gagal'.padEnd(18)}: ${counters.failed}`);
  console.log(`  ${'total ukuran'.padEnd(18)}: ${formatBytes(counters.bytes)}`);
};

await main();
await closeMySql();
await closeLegacyMySql();
closeS3();
