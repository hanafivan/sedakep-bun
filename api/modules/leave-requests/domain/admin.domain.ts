import { badRequest, notFound } from '../../../shared/errors';
import {
  deleteClosurePeriod,
  insertAuditLog,
  insertClosurePeriod,
  updateClosurePeriod,
  upsertSetting,
} from '../command';
import {
  findAllClosurePeriods,
  findInstanceProfile,
  findPppkTmtEntries,
  findPppkUsersMissingTmt,
  findQuotaBookRows,
  findRecentQuotaAudits,
  findUserDirectory,
  countUserDirectory,
} from '../query';

/**
 * Service administrasi cuti: pengaturan instansi, periode tutup tahunan,
 * buku cuti, dan validasi TMT PPPK. Tidak ada SQL di file ini.
 */

// ---------------------------------------------------------------------------
// Pengaturan instansi (legacy tbl_instansi; dipakai kop surat dan sidebar)
// ---------------------------------------------------------------------------

const INSTANCE_FIELDS = ['name', 'address', 'logo', 'website', 'email', 'status', 'head_name', 'head_nip'] as const;
export type InstanceField = (typeof INSTANCE_FIELDS)[number];

export const getInstanceProfile = async () => {
  const profile = await findInstanceProfile();
  return profile;
};

export const updateInstanceProfile = async (
  input: Partial<Record<InstanceField, string | null>>,
  actorId: number,
) => {
  const before = await findInstanceProfile();
  for (const [key, value] of Object.entries(input)) {
    if (!INSTANCE_FIELDS.includes(key as InstanceField)) continue;
    await upsertSetting(`instance.${key}`, value ?? null, 'Identitas instansi');
  }
  await insertAuditLog({
    actor_id: actorId,
    action: 'instance_profile_update',
    entity_table: 'settings',
    entity_id: null,
    before_data: before,
    after_data: input,
  });
  return findInstanceProfile();
};

// ---------------------------------------------------------------------------
// Periode tutup tahunan
// ---------------------------------------------------------------------------

export const listClosurePeriods = async () => findAllClosurePeriods();

export const createClosurePeriod = async (
  input: {
    year: number;
    start_date: string;
    end_date: string;
    enabled?: boolean;
    message?: string | null;
  },
  actorId: number,
) => {
  if (input.start_date > input.end_date) {
    throw badRequest('Tanggal mulai tidak boleh melewati tanggal selesai');
  }
  const id = await insertClosurePeriod({ ...input, actor_id: actorId });
  await insertAuditLog({
    actor_id: actorId,
    action: 'closure_period_create',
    entity_table: 'leave_closure_periods',
    entity_id: id,
    after_data: input,
  });
  return { id };
};

export const updateClosurePeriodById = async (
  id: number,
  input: {
    year?: number;
    start_date?: string;
    end_date?: string;
    enabled?: boolean;
    message?: string | null;
  },
  actorId: number,
) => {
  const periods = await findAllClosurePeriods();
  const existing = periods.find((p) => p.id === id);
  if (!existing) throw notFound('Periode tutup tidak ditemukan');

  const nextStart = input.start_date ?? String(existing.start_date).slice(0, 10);
  const nextEnd = input.end_date ?? String(existing.end_date).slice(0, 10);
  if (nextStart > nextEnd) throw badRequest('Tanggal mulai tidak boleh melewati tanggal selesai');

  await updateClosurePeriod(id, { ...input, actor_id: actorId });
  await insertAuditLog({
    actor_id: actorId,
    action: 'closure_period_update',
    entity_table: 'leave_closure_periods',
    entity_id: id,
    before_data: existing,
    after_data: input,
  });
  return { id };
};

export const removeClosurePeriod = async (id: number, actorId: number) => {
  const periods = await findAllClosurePeriods();
  const existing = periods.find((p) => p.id === id);
  if (!existing) throw notFound('Periode tutup tidak ditemukan');
  await deleteClosurePeriod(id);
  await insertAuditLog({
    actor_id: actorId,
    action: 'closure_period_delete',
    entity_table: 'leave_closure_periods',
    entity_id: id,
    before_data: existing,
  });
};

// ---------------------------------------------------------------------------
// Buku cuti dan daftar pegawai
// ---------------------------------------------------------------------------

export const getQuotaBook = async (year: number, filter: { search?: string; page?: number; perPage?: number }) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 50, 1), 500);
  const page = Math.max(filter.page ?? 1, 1);
  const rows = await findQuotaBookRows(year, {
    search: filter.search,
    limit: perPage,
    offset: (page - 1) * perPage,
  });
  return { items: rows, page, per_page: perPage, year };
};

export const listUsers = async (filter: { search?: string; page?: number; perPage?: number }) => {
  const perPage = Math.min(Math.max(filter.perPage ?? 25, 1), 200);
  const page = Math.max(filter.page ?? 1, 1);
  const [items, total] = await Promise.all([
    findUserDirectory({ search: filter.search, limit: perPage, offset: (page - 1) * perPage }),
    countUserDirectory({ search: filter.search }),
  ]);
  return { items, total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) };
};

/** Riwayat mutasi kuota lintas pegawai — dasar halaman audit. */
export const getQuotaAuditTrail = async (filter: { action?: string; year?: number; limit?: number }) =>
  findRecentQuotaAudits(filter);

// ---------------------------------------------------------------------------
// Validasi TMT PPPK
// ---------------------------------------------------------------------------

export const getPppkTmtSummary = async () => {
  const [recorded, missing] = await Promise.all([
    findPppkTmtEntries(),
    findPppkUsersMissingTmt(),
  ]);
  return { recorded, missing };
};