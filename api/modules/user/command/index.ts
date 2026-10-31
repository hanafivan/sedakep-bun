import { getMySql, type MysqlRow } from '../../../db/mysql';
import type { NewUser } from '../schema/types';

/**
 * COMMAND = operasi tulis modul user. Semua INSERT/UPDATE/DELETE modul user di sini.
 * Tidak ada logika bisnis di file ini.
 */

export const insertUser = async (user: NewUser): Promise<number> => {
  const [result] = await getMySql().query<MysqlRow[]>(
    `INSERT INTO users (
       legacy_id, username, password_hash, password_algo, name, nip, role,
       is_admin, employment_type
     ) VALUES (?,?,?,?,?,?,?,?,?)`,
    [
      user.legacy_id ?? null,
      user.username,
      user.password_hash,
      user.password_algo ?? 'argon2id',
      user.name,
      user.nip ?? null,
      user.role ?? 'pegawai',
      user.is_admin ? 1 : 0,
      user.employment_type ?? 'unknown',
    ],
  );
  const header = result as unknown as { insertId: number };
  return Number(header.insertId);
};

export const updateUser = async (
  id: number,
  data: Record<string, unknown>,
): Promise<void> => {
  const columns = Object.keys(data);
  if (columns.length === 0) return;
  const assignments = columns.map((column) => `\`${column}\` = ?`).join(', ');
  const values = columns.map((column) => data[column] ?? null);
  await getMySql().query(`UPDATE users SET ${assignments} WHERE id = ?`, [...values, id]);
};

export const updateUserPassword = async (
  id: number,
  passwordHash: string,
  algo: 'md5' | 'bcrypt' | 'argon2id',
): Promise<void> => {
  await getMySql().query(
    'UPDATE users SET password_hash = ?, password_algo = ?, must_rehash = 0 WHERE id = ?',
    [passwordHash, algo, id],
  );
};

export const touchLastLogin = async (id: number): Promise<void> => {
  await getMySql().query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [id]);
};

export const deleteUser = async (id: number): Promise<void> => {
  await getMySql().query('DELETE FROM users WHERE id = ?', [id]);
};
