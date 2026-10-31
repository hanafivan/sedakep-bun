#!/usr/bin/env bun
/**
 * Backup operasional terkontrol (Fase 12.19).
 *
 *   bun run backup
 *
 * - Dump database aplikasi ke `backups/db-<stamp>.sql` memakai `mysqldump`.
 * - Mencatat jumlah baris `documents` sebagai penanda.
 *
 * Objek MinIO TIDAK disalin di sini (bisa besar); gunakan `mc mirror` dengan
 * versioning/retention — lihat docs/cutover-runbook.md. Endpoint restore tidak
 * pernah dibuka ke user biasa.
 */
import { mkdir } from 'node:fs/promises';
import { config } from '../api/config';
import { closeMySql, mysqlQuery } from '../api/db/mysql';
import type { RowDataPacket } from 'mysql2/promise';

const MYSQLDUMP = process.env.MYSQLDUMP_BIN ?? 'mysqldump';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');

const main = async (): Promise<void> => {
  await mkdir('backups', { recursive: true });
  const file = `backups/db-${stamp}.sql`;

  const args = ['-h', config.mysql.host, '-P', String(config.mysql.port), '-u', config.mysql.user];
  if (config.mysql.password) args.push(`-p${config.mysql.password}`);
  args.push('--single-transaction', '--routines', '--databases', config.mysql.database);

  const proc = Bun.spawnSync([MYSQLDUMP, ...args], { stdout: 'pipe', stderr: 'pipe' });
  if (proc.exitCode !== 0) {
    console.error(`mysqldump gagal (exit ${proc.exitCode}).`);
    console.error(new TextDecoder().decode(proc.stderr).trim());
    console.error('Pastikan mysqldump tersedia (mis. /Applications/XAMPP/xamppfiles/bin/mysqldump) lewat env MYSQLDUMP_BIN.');
    process.exit(1);
  }
  await Bun.write(file, proc.stdout);

  const rows = await mysqlQuery<Array<RowDataPacket & { c: number }>>(
    'SELECT COUNT(*) AS c FROM documents',
  );
  const documents = Number(rows[0]?.c ?? 0);

  console.log(`Backup database : ${file}`);
  console.log(`Baris documents : ${documents}`);
  console.log('Objek MinIO     : gunakan `mc mirror` + versioning (lihat cutover runbook).');
};

await main();
await closeMySql();
