import type { Connection } from 'mysql2/promise';
import { createConnection } from 'mysql2/promise';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { config } from '../config';
import { logger } from '../shared/logger';

/**
 * Runner migrasi bernomor.
 *
 * Setiap file di api/db/migrations bernama NNNN_nama.sql dan dijalankan
 * berurutan. Idempotent: file yang sudah tercatat di schema_migrations
 * dilewati, jadi runner boleh dipanggil berulang kali.
 *
 * Checksum SHA-256 disimpan agar migrasi yang sudah diterapkan tapi file-nya
 * diubah setelahnya bisa dideteksi (dilaporkan, tidak dieksekusi ulang).
 */

const MIGRATION_DIR = join(import.meta.dir, 'migrations');

export type MigrationTarget = 'app' | 'legacy';

const connectionOptions = (target: MigrationTarget) =>
  target === 'legacy'
    ? {
        host: config.legacyMysql.host,
        port: config.legacyMysql.port,
        user: config.legacyMysql.user,
        password: config.legacyMysql.password,
        database: config.legacyMysql.database,
      }
    : {
        host: config.mysql.host,
        port: config.mysql.port,
        user: config.mysql.user,
        password: config.mysql.password,
        database: config.mysql.database,
      };

const openConnection = (target: MigrationTarget, includeDatabase = true) =>
  createConnection({
    ...(includeDatabase
      ? connectionOptions(target)
      : { ...connectionOptions(target), database: undefined }),
    multipleStatements: true,
    charset: 'utf8mb4',
  });

/** Koneksi tanpa nama database — dibutuhkan untuk CREATE DATABASE. */
const openServerConnection = () =>
  createConnection({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    multipleStatements: true,
    charset: 'utf8mb4',
  });

export const ensureDatabase = async (name = config.mysql.database): Promise<void> => {
  const connection = await openServerConnection();
  try {
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
  } finally {
    await connection.end();
  }
};

export const listMigrationFiles = (): string[] =>
  readdirSync(MIGRATION_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

export const migrationId = (file: string): string => file.split('_')[0] ?? file;

export const checksumOf = (sql: string): string =>
  createHash('sha256').update(sql, 'utf8').digest('hex');

const ensureMigrationTable = async (connection: Connection): Promise<void> => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          VARCHAR(120)  NOT NULL,
      name        VARCHAR(191)  NOT NULL,
      checksum    CHAR(64)      NOT NULL,
      applied_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
};

const appliedMigrations = async (
  connection: Connection,
): Promise<Map<string, string>> => {
  const [result] = await connection.query(
    'SELECT id, checksum FROM schema_migrations ORDER BY id',
  );
  const list = result as Array<{ id: string; checksum: string }>;
  return new Map(list.map((row) => [row.id, row.checksum]));
};

export type MigrationResult = {
  applied: string[];
  skipped: string[];
  drifted: string[];
  dryRun: boolean;
};

export const runMigrations = async (
  options: { dryRun?: boolean; target?: MigrationTarget; ensureDb?: boolean } = {},
): Promise<MigrationResult> => {
  const dryRun = options.dryRun ?? false;
  const target = options.target ?? 'app';
  const files = listMigrationFiles();

  if (!dryRun && (options.ensureDb ?? true) && target === 'app') await ensureDatabase();

  const connection = await openConnection(target);
  const result: MigrationResult = { applied: [], skipped: [], drifted: [], dryRun };

  try {
    if (!dryRun) await ensureMigrationTable(connection);
    const done = dryRun ? new Map<string, string>() : await appliedMigrations(connection);

    for (const file of files) {
      const id = migrationId(file);
      const sql = readFileSync(join(MIGRATION_DIR, file), 'utf8');
      const checksum = checksumOf(sql);

      const previous = done.get(id);
      if (previous !== undefined) {
        if (previous !== checksum) result.drifted.push(file);
        result.skipped.push(file);
        continue;
      }

      if (dryRun) {
        result.applied.push(file);
        continue;
      }

      await connection.query(sql);
      await connection.query(
        'INSERT IGNORE INTO schema_migrations (id, name, checksum) VALUES (?, ?, ?)',
        [id, file, checksum],
      );
      result.applied.push(file);
      logger.info('migration', `applied ${file}`, { target });
    }
  } finally {
    await connection.end();
  }

  return result;
};

export const migrationStatus = async (
  target: MigrationTarget = 'app',
): Promise<Array<{ file: string; applied: boolean; drifted: boolean }>> => {
  const connection = await openConnection(target);
  try {
    await ensureMigrationTable(connection);
    const done = await appliedMigrations(connection);
    return listMigrationFiles().map((file) => {
      const checksum = checksumOf(readFileSync(join(MIGRATION_DIR, file), 'utf8'));
      const previous = done.get(migrationId(file));
      return {
        file,
        applied: previous !== undefined,
        drifted: previous !== undefined && previous !== checksum,
      };
    });
  } finally {
    await connection.end();
  }
};
