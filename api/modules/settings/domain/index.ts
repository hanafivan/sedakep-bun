import { badRequest, notFound } from '../../../shared/errors';
import { deleteSettingRow, insertAuditLog, upsertSettingRow } from '../command';
import { findSettingByKey, findSettings } from '../query';
import type { SettingRow } from '../schema/types';

/**
 * Domain pengaturan — aturan bisnis. Tanpa SQL.
 *
 * - Kunci divalidasi; kunci berawalan `scheduler.` dikelola sistem (read-only).
 * - Nilai yang terlihat seperti rahasia ditutup di daftar (admin tetap bisa
 *   membukanya lewat GET satu kunci).
 * - Setiap perubahan dicatat ke `audit_logs`.
 */

const KEY_PATTERN = /^[a-z0-9_.:-]{1,75}$/;
const SECRET_PATTERN = /(secret|password|passwd|token|salt|access[_-]?key)/i;

const isSecret = (key: string): boolean => SECRET_PATTERN.test(key);
const isReadonly = (key: string): boolean => key.startsWith('scheduler.');

const toPublic = (row: SettingRow, mask: boolean) => ({
  key: row.key,
  value: mask && isSecret(row.key) && row.value !== null ? '••••••' : row.value,
  description: row.description,
  updated_at: String(row.updated_at),
  secret: isSecret(row.key),
  readonly: isReadonly(row.key),
});

const assertWritableKey = (key: string): void => {
  if (!KEY_PATTERN.test(key)) throw badRequest('Kunci pengaturan tidak valid');
  if (isReadonly(key)) throw badRequest('Pengaturan ini dikelola sistem dan tidak dapat diubah');
};

export const listSettings = async (filter: { prefix?: string; search?: string } = {}) => {
  const items = await findSettings(filter);
  return items.map((row) => toPublic(row, true));
};

export const getSetting = async (key: string) => {
  const row = await findSettingByKey(key);
  if (!row) throw notFound('Pengaturan tidak ditemukan');
  return toPublic(row, false);
};

export const setSetting = async (
  key: string,
  input: { value: string | null; description?: string | null },
  actorId: number,
) => {
  assertWritableKey(key);
  const before = await findSettingByKey(key);
  await upsertSettingRow({ key, value: input.value, description: input.description ?? null });
  await insertAuditLog({
    actor_id: actorId,
    action: 'setting_update',
    entity_table: 'settings',
    entity_id: before?.id ?? null,
    before_data: before
      ? { key, value: before.value, description: before.description }
      : null,
    after_data: { key, value: input.value, description: input.description ?? null },
  });
  const row = await findSettingByKey(key);
  return toPublic(row as SettingRow, false);
};

export const removeSetting = async (key: string, actorId: number) => {
  assertWritableKey(key);
  const before = await findSettingByKey(key);
  if (!before) throw notFound('Pengaturan tidak ditemukan');
  await deleteSettingRow(key);
  await insertAuditLog({
    actor_id: actorId,
    action: 'setting_delete',
    entity_table: 'settings',
    entity_id: before.id,
    before_data: { key, value: before.value, description: before.description },
  });
  return { key };
};

