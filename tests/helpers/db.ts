import { describe, expect, it } from 'bun:test';
import { config } from '../../api/config';

/** Flag diisi oleh api/test-setup.ts setelah migrasi database test berhasil. */
export const mysqlReady = (): boolean =>
  (globalThis as unknown as { __MYSQL_READY__?: boolean }).__MYSQL_READY__ === true;

const isTestDatabase = (): boolean => config.mysql.database.endsWith('_test');

/**
 * describe untuk test yang butuh MySQL.
 *
 * Hanya aktif kalau database yang dipakai jelas database test. Kalau nama
 * database tidak berakhiran `_test`, test DB dimatikan — bukan sekadar
 * di-skip, tapi juga tidak boleh dijalankan sama sekali.
 */
export const describeDb = mysqlReady() && isTestDatabase() ? describe : describe.skip;

/** Pastikan test yang menulis data tidak pernah kena database aplikasi. */
export const assertTestDatabase = (): void => {
  if (!isTestDatabase()) {
    throw new Error(
      `Test menulis ke database "${config.mysql.database}" — bukan database test. Dibatalkan.`,
    );
  }
};

describe('guard database test', () => {
  it('nama database berakhiran _test', () => {
    expect(isTestDatabase()).toBe(true);
  });
});
