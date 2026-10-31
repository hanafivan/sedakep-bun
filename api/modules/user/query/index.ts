import { getMySql, type MysqlRow } from '../../../db/mysql';
import type { UserRow } from '../schema/types';

/**
 * QUERY = operasi baca modul user. Semua SQL SELECT modul user ada di sini.
 * Tidak ada logika bisnis di file ini.
 */

const rows = async (sql: string, params: unknown[] = []): Promise<UserRow[]> => {
  const [result] = await getMySql().query<MysqlRow[]>(sql, params);
  return result as unknown as UserRow[];
};

const one = async (sql: string, params: unknown[] = []): Promise<UserRow | null> => {
  const result = await rows(sql, params);
  return result[0] ?? null;
};

export const findUserByUsername = async (username: string): Promise<UserRow | null> =>
  one('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);

export const findUserById = async (id: number): Promise<UserRow | null> =>
  one('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);

export const findUserByNip = async (nip: string): Promise<UserRow | null> =>
  one('SELECT * FROM users WHERE nip = ? LIMIT 1', [nip]);

export const countUsers = async (): Promise<number> => {
  const [result] = await getMySql().query<MysqlRow[]>(
    'SELECT COUNT(*) AS total FROM users',
  );
  const row = result[0] as { total: number } | undefined;
  return Number(row?.total ?? 0);
};

export const listUsers = async (filter: {
  search?: string;
  role?: string;
  organizationId?: number;
  isActive?: boolean;
  limit: number;
  offset: number;
}): Promise<UserRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.search) {
    where.push('(u.name LIKE ? OR u.username LIKE ? OR u.nip LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like);
  }
  if (filter.role) {
    where.push('u.role = ?');
    params.push(filter.role);
  }
  if (filter.organizationId) {
    where.push('u.organization_id = ?');
    params.push(filter.organizationId);
  }
  if (filter.isActive !== undefined) {
    where.push('u.is_active = ?');
    params.push(filter.isActive ? 1 : 0);
  }

  const sql = `SELECT u.* FROM users u
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY u.name ASC LIMIT ? OFFSET ?`;

  return rows(sql, [...params, filter.limit, filter.offset]);
};

export const countUsersByFilter = async (filter: {
  search?: string;
  role?: string;
  organizationId?: number;
  isActive?: boolean;
}): Promise<number> => {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filter.search) {
    where.push('(name LIKE ? OR username LIKE ? OR nip LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like, like);
  }
  if (filter.role) {
    where.push('role = ?');
    params.push(filter.role);
  }
  if (filter.organizationId) {
    where.push('organization_id = ?');
    params.push(filter.organizationId);
  }
  if (filter.isActive !== undefined) {
    where.push('is_active = ?');
    params.push(filter.isActive ? 1 : 0);
  }

  const [result] = await getMySql().query<MysqlRow[]>(
    `SELECT COUNT(*) AS total FROM users ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params,
  );
  const row = result[0] as { total: number } | undefined;
  return Number(row?.total ?? 0);
};

export const findOrganizationById = async (
  id: number,
): Promise<{ id: number; code: string; name: string } | null> => {
  const [result] = await getMySql().query<MysqlRow[]>(
    'SELECT id, code, name FROM organizations WHERE id = ? LIMIT 1',
    [id],
  );
  return (result[0] as { id: number; code: string; name: string } | undefined) ?? null;
};
