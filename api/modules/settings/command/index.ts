import { getMySql } from '../../../db/mysql';
import type { Executor } from '../../../shared/db';

/** COMMAND = operasi tulis modul pengaturan. Tanpa logika bisnis. */

export type { Executor };
export { insertAuditLog } from '../../../shared/db';

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
