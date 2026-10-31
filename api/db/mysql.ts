import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { config } from '../config';

let pool: Pool | undefined;

export const getMySql = (): Pool => {
  if (!pool) {
    pool = mysql.createPool({
      host: config.mysql.host,
      port: config.mysql.port,
      user: config.mysql.user,
      password: config.mysql.password,
      database: config.mysql.database,
      connectionLimit: config.mysql.connectionLimit,
      waitForConnections: true,
      queueLimit: 0,
      charset: 'utf8mb4',
      namedPlaceholders: true,
      // DATE/DATETIME dikembalikan sebagai string 'YYYY-MM-DD', bukan objek Date.
      // Tanpa ini mysql2 mengubahnya jadi Date pada zona waktu lokal, sehingga
      // String(value).slice(0,10) menghasilkan "Mon Oct 12" (bukan tanggal ISO)
      // dan YEAR(start_date) di sisi aplikasi jadi NaN — pernah membuat
      // reserved & pemakaian kuota tidak terhitung.
      dateStrings: true,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    });
  }
  return pool;
};

export type MysqlRow = RowDataPacket & Record<string, unknown>;

export const mysqlQuery = async <T extends MysqlRow[] = MysqlRow[]>(
  sql: string,
  params?: unknown[],
): Promise<T> => {
  const [rows] = await getMySql().query<T>(sql, params as mysql.QueryValues | undefined);
  return rows;
};

export const mysqlExecute = async (
  sql: string,
  params?: unknown[],
): Promise<ResultSetHeader> => {
  const [result] = await getMySql().execute<ResultSetHeader>(sql, params as mysql.ExecuteValues | undefined);
  return result;
};

export const withMysqlTransaction = async <T>(
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> => {
  const connection = await getMySql().getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

/**
 * Transaksi dengan kunci penamaan MySQL (GET_LOCK) sebagai serialisasi.
 *
 * Dipakai saat reservasi kuota: dua permohonan yang masuk bersamaan untuk
 * user+tahun yang sama harus diproses satu per satu, kalau tidak keduanya
 * membaca saldo yang sama dan keduanya lolos validasi (oversubscribe).
 *
 * Kunci dilepas SETELAH commit, bukan sebelum, supaya sesi lain baru bisa
 * masuk ketika datanya sudah benar-benar terlihat. GET_LOCK bersifat global
 * per server, karena itu nama kunci diberi prefix database.
 */
export const withLockedTransaction = async <T>(
  lockName: string,
  callback: (connection: PoolConnection) => Promise<T>,
  timeoutSeconds = 10,
): Promise<T> => {
  const connection = await getMySql().getConnection();
  const name = `${config.mysql.database}:${lockName}`.slice(0, 64);
  try {
    const [lockRows] = await connection.query('SELECT GET_LOCK(?, ?) AS acquired', [
      name,
      timeoutSeconds,
    ]);
    const acquired = Number(
      (lockRows as Array<{ acquired: number | null }>)[0]?.acquired ?? 0,
    );
    if (acquired !== 1) {
      throw new Error(`Gagal mengambil kunci ${name} dalam ${timeoutSeconds} detik`);
    }

    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    await connection.query('SELECT RELEASE_LOCK(?)', [name]).catch(() => undefined);
    connection.release();
  }
};


export const mysqlHealthcheck = async (): Promise<boolean> => {
  const connection = await getMySql().getConnection();
  try {
    await connection.ping();
    return true;
  } finally {
    connection.release();
  }
};

export const closeMySql = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};