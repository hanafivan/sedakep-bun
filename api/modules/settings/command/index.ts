import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMySql } from '../../../db/mysql';

/** COMMAND = operasi tulis modul pengaturan. Tanpa logika bisnis. */

export type Executor = Pool | PoolConnection;

export const upsertSettingRow = async (
  data: { key: string; value: string | null; description?: string | null },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO settings (\`key\`, value, description, updated_at)
     VALUES (?,?,?,NOW())
     ON DUPLICATE KEY UPDATE value = VALUES(value),
       description = COALESCE(VALUES(description), description),
       updated_at = NOW()`,
    [data.key, data.value, data.description ?? null],
  );
};

export const deleteSettingRow = async (key: string, executor: Executor = getMySql()): Promise<void> => {
  await executor.execute('DELETE FROM settings WHERE `key` = ?', [key]);
};

export const insertAuditLog = async (
  data: {
    actor_id?: number | null;
    action: string;
    entity_table: string;
    entity_id?: number | null;
    before_data?: unknown;
    after_data?: unknown;
  },
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute(
    `INSERT INTO audit_logs (actor_id, action, entity_table, entity_id, before_data, after_data)
     VALUES (?,?,?,?,?,?)`,
    [
      data.actor_id ?? null,
      data.action,
      data.entity_table,
      data.entity_id ?? null,
      data.before_data === undefined ? null : JSON.stringify(data.before_data),
      data.after_data === undefined ? null : JSON.stringify(data.after_data),
    ],
  );
};
