import type { Pool, PoolConnection, RowDataPacket } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';
import type { OrganizationRow, PositionRow } from '../schema/types';

/** QUERY = operasi baca master data. Tanpa logika bisnis. */

type Executor = Pool | PoolConnection;

const rows = async <T>(executor: Executor, sql: string, params: unknown[] = []): Promise<T[]> => {
  const [result] = await executor.query<RowDataPacket[]>(sql, params);
  return result as unknown as T[];
};

export const findOrganizations = async (
  filter: { search?: string; activeOnly?: boolean } = {},
  executor: Executor = getMySql(),
): Promise<OrganizationRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.activeOnly) where.push('is_active = 1');
  if (filter.search) {
    where.push('(code LIKE ? OR name LIKE ?)');
    const like = `%${filter.search}%`;
    params.push(like, like);
  }
  return rows<OrganizationRow>(
    executor,
    `SELECT * FROM organizations ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name ASC`,
    params,
  );
};

export const findOrganizationById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<OrganizationRow | null> => {
  const result = await rows<OrganizationRow>(
    executor,
    'SELECT * FROM organizations WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findOrganizationByCode = async (
  code: string,
  executor: Executor = getMySql(),
): Promise<OrganizationRow | null> => {
  const result = await rows<OrganizationRow>(
    executor,
    'SELECT * FROM organizations WHERE code = ? LIMIT 1',
    [code],
  );
  return result[0] ?? null;
};

export const findPositions = async (
  filter: { search?: string; activeOnly?: boolean } = {},
  executor: Executor = getMySql(),
): Promise<PositionRow[]> => {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.activeOnly) where.push('is_active = 1');
  if (filter.search) {
    where.push('name LIKE ?');
    params.push(`%${filter.search}%`);
  }
  return rows<PositionRow>(
    executor,
    `SELECT * FROM positions ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY name ASC`,
    params,
  );
};

export const findPositionById = async (
  id: number,
  executor: Executor = getMySql(),
): Promise<PositionRow | null> => {
  const result = await rows<PositionRow>(
    executor,
    'SELECT * FROM positions WHERE id = ? LIMIT 1',
    [id],
  );
  return result[0] ?? null;
};

export const findPositionByName = async (
  name: string,
  executor: Executor = getMySql(),
): Promise<PositionRow | null> => {
  const result = await rows<PositionRow>(
    executor,
    'SELECT * FROM positions WHERE name = ? LIMIT 1',
    [name],
  );
  return result[0] ?? null;
};
