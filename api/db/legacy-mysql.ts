import mysql, { type Pool, type RowDataPacket } from 'mysql2/promise';
import { config } from '../config';

/**
 * Pool read-only ke database legacy ptsp_sedakep.
 * Dipakai hanya oleh script migrasi dan fallback pembacaan selama cutover.
 * Aplikasi utama tidak boleh menulis ke pool ini.
 */

let pool: Pool | undefined;

export const getLegacyMySql = (): Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.legacyMysql.host,
      port: config.legacyMysql.port,
      user: config.legacyMysql.user,
      password: config.legacyMysql.password,
      database: config.legacyMysql.database,
      connectionLimit: 5,
      waitForConnections: true,
      queueLimit: 0,
      charset: 'utf8mb4',
      dateStrings: true,
    });
  }
  return pool;
};

export type LegacyRow = RowDataPacket & Record<string, unknown>;

export const legacyQuery = async <T extends LegacyRow[] = LegacyRow[]>(
  sql: string,
  params?: unknown[],
): Promise<T> => {
  const [rows] = await getLegacyMySql().query<T>(sql, params as mysql.QueryValues | undefined);
  return rows;
};

export const legacyHealthcheck = async (): Promise<boolean> => {
  const connection = await getLegacyMySql().getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
};

export const closeLegacyMySql = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};
