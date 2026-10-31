/**
 * Verifikasi adapter MySQL.
 *
 * Jalankan:
 *   bun run mysql:verify
 */
import { mysqlQuery, mysqlHealthcheck, closeMySql } from '../api/db/mysql';
import { config } from '../api/config';
import type { RowDataPacket } from 'mysql2/promise';

const main = async () => {
  console.log('\n=== Verifikasi adapter MySQL ===');
  console.log(`host     : ${config.mysql.host}:${config.mysql.port}`);
  console.log(`database : ${config.mysql.database}`);

  if (!(await mysqlHealthcheck())) {
    console.error('  GAGAL: ping MySQL tidak berhasil');
    process.exit(1);
  }
  console.log('✓ ping');

  const [version] = await mysqlQuery<(RowDataPacket & { v: string })[]>(
    'SELECT VERSION() AS v',
  );
  console.log(`✓ versi server: ${version?.v}`);

  const tables = await mysqlQuery<(RowDataPacket & { t: string })[]>(
    `SELECT table_name AS t FROM information_schema.tables
      WHERE table_schema = ? ORDER BY table_name LIMIT 5`,
    [config.mysql.database],
  );
  console.log(`✓ contoh tabel: ${tables.map((row) => row.t).join(', ')}`);

  // parameter binding — pastikan placeholder tidak diinterpolasi manual
  const [one] = await mysqlQuery<(RowDataPacket & { n: number })[]>('SELECT ? + ? AS n', [2, 3]);
  if (one?.n !== 5) {
    console.error('  GAGAL: parameter binding tidak benar');
    process.exit(1);
  }
  console.log('✓ parameter binding');

  await closeMySql();
  console.log('\nSemua pemeriksaan adapter MySQL lulus.\n');
};

await main();
