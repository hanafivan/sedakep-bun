#!/usr/bin/env bun
/**
 * Rekonsiliasi kuota: engine baru vs snapshot legacy `tbl_cuti_quota`.
 *
 *   bun run quota:reconcile --year 2025
 *
 * Perbedaan TIDAK otomatis berarti engine baru salah: snapshot legacy dikenal
 * rusak (hanya ~202 baris/tahun untuk 1.730 pegawai, dan `deductQuota()` tidak
 * dipanggil konsisten). Output dipakai untuk menilai mana yang wajar.
 */
import { closeMySql, getMySql, type MysqlRow } from '../api/db/mysql';
import { getLegacyMySql, closeLegacyMySql } from '../api/db/legacy-mysql';
import { loadMapping } from '../api/migrate/legacy-map';

const args = process.argv.slice(2);
const index = args.indexOf('--year');
const year = index >= 0 ? Number(args[index + 1]) : new Date().getFullYear();

const main = async (): Promise<void> => {
  const targetToLegacy = await loadMapping('tbl_user', 'users');
  const legacyToTarget = new Map<number, number>();
  for (const [legacyId, userId] of targetToLegacy) {
    legacyToTarget.set(Number(legacyId), userId);
  }

  const [legacyQuota] = await getLegacyMySql().query<MysqlRow[]>(
    'SELECT id_user, total_sisa, sisa_n, sisa_n1, sisa_n2 FROM tbl_cuti_quota WHERE tahun = ?',
    [year],
  );

  const [targetQuota] = await getMySql().query<MysqlRow[]>(
    `SELECT q.user_id, q.total_remaining, q.remaining_n, q.remaining_n1, q.remaining_n2,
            u.legacy_id, u.name
       FROM leave_quotas q
       JOIN users u ON u.id = q.user_id
      WHERE q.year = ?`,
    [year],
  );

  const targetByUser = new Map<number, Record<string, unknown>>();
  for (const row of targetQuota as unknown as Array<Record<string, unknown>>) {
    targetByUser.set(Number(row.user_id), row);
  }

  let compared = 0;
  let same = 0;
  let differs = 0;
  let legacyOnly = 0;
  const samples: string[] = [];

  for (const raw of legacyQuota as unknown as Array<Record<string, unknown>>) {
    const userId = legacyToTarget.get(Number(raw.id_user));
    if (!userId) {
      legacyOnly += 1;
      continue;
    }
    const target = targetByUser.get(userId);
    if (!target) {
      legacyOnly += 1;
      continue;
    }
    compared += 1;
    const legacyTotal = Number(raw.total_sisa ?? 0);
    const targetTotal = Number(target.total_remaining ?? 0);
    if (legacyTotal === targetTotal) {
      same += 1;
    } else {
      differs += 1;
      if (samples.length < 15) {
        samples.push(
          `user ${userId} (${target.name}): legacy ${legacyTotal} (${raw.sisa_n}/${raw.sisa_n1}/${raw.sisa_n2}) vs engine ${targetTotal} (${target.remaining_n}/${target.remaining_n1}/${target.remaining_n2})`,
        );
      }
    }
  }

  console.log(`Tahun dibandingkan : ${year}`);
  console.log(`Snapshot legacy    : ${legacyQuota.length} baris`);
  console.log(`Projection target  : ${targetQuota.length} baris`);
  console.log(`Dibandingkan       : ${compared}`);
  console.log(`Sama               : ${same}`);
  console.log(`Berbeda            : ${differs}`);
  console.log(`Hanya di legacy    : ${legacyOnly}`);
  console.log('\nContoh perbedaan (legacy vs engine):');
  for (const sample of samples) console.log(`  - ${sample}`);
};

await main();
await closeMySql();
await closeLegacyMySql();
