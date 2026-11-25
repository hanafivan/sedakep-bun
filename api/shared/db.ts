import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../db/mysql';

/**
 * Helper database bersama untuk seluruh modul API.
 * Jangan duplikat Executor, rows, insertAuditLog, atau query profil di tiap modul.
 */

/** Eksekutor DB: pool default (getMySql) atau koneksi transaksi (PoolConnection). */
export type Executor = Pool | PoolConnection;

/** Wrapper generik untuk query SELECT. */
export const rows = async <T>(
  executor: Executor,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

/**
 * Susun klausa SET dinamis `kolom = ?` untuk query UPDATE berdasarkan whitelist.
 * Mengembalikan null bila tidak ada field pada `data` yang bernilai !== undefined.
 */
export const pickUpdateColumns = (
  data: Record<string, unknown>,
  allowed: readonly string[] | Record<string, string>,
): { setClause: string; values: unknown[] } | null => {
  const columns: string[] = [];
  const values: unknown[] = [];
  const entries = Array.isArray(allowed)
    ? allowed.map((key) => [key, key] as const)
    : Object.entries(allowed);

  for (const [key, column] of entries) {
    if (data[key] !== undefined) {
      columns.push(`${column} = ?`);
      values.push(data[key]);
    }
  }
  if (columns.length === 0) return null;
  return { setClause: columns.join(', '), values };
};

/**
 * Catat aksi ke tabel `audit_logs`.
 * `ip_address` bersifat opsional agar kompatibel dengan seluruh modul.
 */
export const insertAuditLog = async (
  data: {
    actor_id?: number | null;
    action: string;
    entity_table: string;
    entity_id?: number | null;
    before_data?: unknown;
    after_data?: unknown;
    ip_address?: string | null;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO audit_logs (actor_id, action, entity_table, entity_id, before_data, after_data, ip_address)
     VALUES (?,?,?,?,?,?,?)`,
    [
      data.actor_id ?? null,
      data.action,
      data.entity_table,
      data.entity_id ?? null,
      data.before_data === undefined ? null : JSON.stringify(data.before_data),
      data.after_data === undefined ? null : JSON.stringify(data.after_data),
      data.ip_address ?? null,
    ],
  );
};

/**
 * Identitas instansi (kop surat, alamat, pejabat) dari tabel `settings` dengan prefix `instance.`.
 */
export const findInstanceProfile = async (
  executor: Executor = getMySql(),
): Promise<Record<string, string | null>> => {
  const result = await rows<{ key: string; value: string | null }>(
    executor,
    "SELECT `key`, value FROM settings WHERE `key` LIKE 'instance.%'",
  );
  const profile: Record<string, string | null> = {};
  for (const row of result) {
    profile[row.key.replace(/^instance\./, '')] = row.value;
  }
  return profile;
};

/** Ambil NIP pegawai berdasarkan ID user. */
export const findUserNipById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<string | null> => {
  const result = await rows<{ nip: string | null }>(
    executor,
    'SELECT nip FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return result[0]?.nip ?? null;
};

export type UserProfileRow = {
  id: number;
  name: string;
  nip: string | null;
  grade: string | null;
  unit_name: string | null;
  position_name: string | null;
  organization_name: string | null;
};

/** Ambil profil lengkap pegawai (beserta nama jabatan & organisasi). */
export const findUserProfileById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<UserProfileRow | null> => {
  const result = await rows<UserProfileRow>(
    executor,
    `SELECT u.id, u.name, u.nip, u.grade, u.unit_name,
            p.name AS position_name, o.name AS organization_name
       FROM users u
       LEFT JOIN positions p ON p.id = u.position_id
       LEFT JOIN organizations o ON o.id = u.organization_id
      WHERE u.id = ? LIMIT 1`,
    [userId],
  );
  return result[0] ?? null;
};

/** Ambil identitas ringkas user (id, nama, NIP). */
export const findUserIdentityById = async (
  userId: number,
  executor: Executor = getMySql(),
): Promise<{ id: number; name: string; nip: string | null } | null> => {
  const result = await rows<{ id: number; name: string; nip: string | null }>(
    executor,
    'SELECT id, name, nip FROM users WHERE id = ? LIMIT 1',
    [userId],
  );
  return result[0] ?? null;
};
