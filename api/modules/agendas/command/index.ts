import { getMySql } from '../../../db/mysql';
import { pickUpdateColumns, type Executor } from '../../../shared/db';
import { nowStamp } from '../../../shared/helpers';

/**
 * COMMAND = operasi tulis modul agenda. Tidak ada logika bisnis di file ini.
 */

export type { Executor };
export { insertAuditLog } from '../../../shared/db';

export type NewAgenda = {
  user_id: number;
  legacy_id?: string | null;
  name?: string | null;
  nip?: string | null;
  title: string;
  place?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  report?: string | null;
};

export const insertAgenda = async (
  data: NewAgenda,
  executor: Executor = getMySql(),
): Promise<number> => {
  const [result] = await executor.execute<import('mysql2/promise').ResultSetHeader>(
    `INSERT INTO agendas (user_id, legacy_id, name, nip, title, place, start_at, end_at, report, reported_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      data.user_id,
      data.legacy_id ?? null,
      data.name ?? null,
      data.nip ?? null,
      data.title,
      data.place ?? null,
      data.start_at ?? null,
      data.end_at ?? null,
      data.report ?? null,
      data.report ? nowStamp() : null,
    ],
  );
  return result.insertId;
};

const AGENDA_COLUMNS = ['name', 'nip', 'title', 'place', 'start_at', 'end_at', 'report'];

export const updateAgenda = async (
  id: number,
  data: Record<string, unknown>,
  executor: Executor = getMySql(),
): Promise<void> => {
  const patch = pickUpdateColumns(data, AGENDA_COLUMNS);
  if (!patch) return;
  await executor.query(`UPDATE agendas SET ${patch.setClause} WHERE id = ?`, [...patch.values, id]);
};

export const setAgendaReport = async (
  id: number,
  report: string,
  executor: Executor = getMySql(),
): Promise<void> => {
  await executor.execute('UPDATE agendas SET report = ?, reported_at = NOW() WHERE id = ?', [
    report,
    id,
  ]);
};

export const deleteAgenda = async (id: number, executor: Executor = getMySql()): Promise<void> => {
  await executor.execute('DELETE FROM agendas WHERE id = ?', [id]);
};
