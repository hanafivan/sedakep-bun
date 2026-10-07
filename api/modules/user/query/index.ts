import type { Database } from 'bun:sqlite';
import type { UserRow } from '../schema/types';

/**
 * QUERY = operasi baca. Semua SQL SELECT modul user tinggal di sini.
 * Tidak ada logika bisnis di file ini.
 */

export const findUserByUsername = (
  db: Database,
  username: string,
): UserRow | null =>
  db
    .query<UserRow, [string]>('SELECT * FROM users WHERE username = ?')
    .get(username);

export const findUserById = (db: Database, id: string): UserRow | null =>
  db
    .query<UserRow, [string]>('SELECT * FROM users WHERE id = ?')
    .get(id);

export const countUsers = (db: Database): number => {
  const row = db.query<{ total: number }, []>(
    'SELECT COUNT(*) AS total FROM users',
  ).get();
  return row?.total ?? 0;
};
