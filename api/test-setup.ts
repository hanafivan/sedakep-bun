#!/usr/bin/env bun
// Preload test (lihat bunfig.toml).
//
// ATURAN KERAS: `bun test` TIDAK PERNAH boleh menyentuh database aplikasi
// (MYSQL_DATABASE dari .env). Test DB selalu memakai database terpisah.
//
// Kenapa ditulis begini: `bun test` memuat .env lebih dulu, jadi MYSQL_DATABASE
// sudah terisi saat file ini jalan. Assign `??=` tidak akan menimpanya, dan
// test yang menjalankan `DELETE FROM users` akan menghapus data produksi
// lewat ON DELETE CASCADE. Karena itu nilainya di-OVERRIDE, bukan di-default.

const TEST_DATABASE = 'sedakep_test';

process.env.JWT_SECRET ??= 'test-secret';
process.env.BASIC_AUTH_USERNAME ??= 'admin';
process.env.BASIC_AUTH_PASSWORD ??= 'admin';
process.env.BASIC_AUTH_SALT ??= 'dev-salt-test';
process.env.BASIC_AUTH_ITERATIONS ??= '100000';
process.env.STORAGE_DRIVER ??= 'local';
process.env.STORAGE_LOCAL_ROOT ??= '.tmp-storage-test';

// Override, bukan default — supaya hasil `.env` tidak bocor ke test.
process.env.MYSQL_DATABASE = TEST_DATABASE;

export {}; // biar file ini dianggap module (top-level await butuh itu)

/**
 * Flag global: true kalau MySQL hidup dan migrasi test berhasil.
 * Test yang butuh DB memakai `describeDb` dari tests/helpers/db.ts.
 */
const flag = globalThis as unknown as { __MYSQL_READY__?: boolean };
flag.__MYSQL_READY__ = false;

try {
  const { ensureDatabase, runMigrations } = await import('./db/migrate');

  // Sabuk pengaman kedua: pastikan yang Dibuat benar-benar DB test.
  const target = process.env.MYSQL_DATABASE;
  if (target !== TEST_DATABASE) {
    throw new Error(`Test menolak jalan di database ${target}; harus ${TEST_DATABASE}`);
  }

  await ensureDatabase();
  await runMigrations({ ensureDb: false });
  flag.__MYSQL_READY__ = true;
} catch {
  // MySQL tidak jalan — test DB di-skip, sisanya tetap jalan.
}
