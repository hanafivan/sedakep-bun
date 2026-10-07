import type { Database } from 'bun:sqlite';
import type { NewUser } from '../schema/types';

/**
 * COMMAND = operasi tulis. Semua SQL INSERT/UPDATE/DELETE modul user di sini.
 * Tidak ada logika bisnis di file ini.
 */

export const insertUser = (db: Database, user: NewUser): void => {
  db.query('INSERT INTO users (id, username, password) VALUES (?, ?, ?)').run(
    user.id,
    user.username,
    user.password,
  );
};

export const updateUserPassword = (
  db: Database,
  id: string,
  hashedPassword: string,
): void => {
  db.query(
    "UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(hashedPassword, id);
};

export const deleteUser = (db: Database, id: string): void => {
  db.query('DELETE FROM users WHERE id = ?').run(id);
};
