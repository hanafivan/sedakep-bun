import { badRequest, notFound } from '../../../shared/errors';
import {
  deleteOrganization,
  deletePosition,
  insertOrganization,
  insertPosition,
  updateOrganization,
  updatePosition,
} from '../command';
import {
  findOrganizationByCode,
  findOrganizationById,
  findOrganizations,
  findPositionById,
  findPositionByName,
  findPositions,
} from '../query';

/** Domain master data — aturan bisnis (unik kode/nama). Tanpa SQL. */

export const listOrganizations = (filter: { search?: string; activeOnly?: boolean } = {}) =>
  findOrganizations(filter);

export const createOrganization = async (input: {
  code: string;
  name: string;
  parent_id?: number | null;
  level?: number;
  is_active?: boolean;
}) => {
  if (await findOrganizationByCode(input.code)) {
    throw badRequest(`Kode organisasi "${input.code}" sudah dipakai`);
  }
  const id = await insertOrganization({
    code: input.code,
    name: input.name,
    parent_id: input.parent_id ?? null,
    level: input.level ?? 1,
    is_active: input.is_active === false ? 0 : 1,
  });
  return { id };
};

export const updateOrganizationById = async (
  id: number,
  input: {
    code?: string;
    name?: string;
    parent_id?: number | null;
    level?: number;
    is_active?: boolean;
  },
) => {
  const existing = await findOrganizationById(id);
  if (!existing) throw notFound('Organisasi tidak ditemukan');
  if (input.code && input.code !== existing.code && (await findOrganizationByCode(input.code))) {
    throw badRequest(`Kode organisasi "${input.code}" sudah dipakai`);
  }
  const patch: Record<string, unknown> = {};
  if (input.code !== undefined) patch.code = input.code;
  if (input.name !== undefined) patch.name = input.name;
  if (input.parent_id !== undefined) patch.parent_id = input.parent_id;
  if (input.level !== undefined) patch.level = input.level;
  if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
  await updateOrganization(id, patch);
  return { id };
};

export const removeOrganization = async (id: number) => {
  if (!(await findOrganizationById(id))) throw notFound('Organisasi tidak ditemukan');
  await deleteOrganization(id);
};

export const listPositions = (filter: { search?: string; activeOnly?: boolean } = {}) =>
  findPositions(filter);

export const createPosition = async (input: {
  name: string;
  grade?: string;
  is_active?: boolean;
}) => {
  if (await findPositionByName(input.name)) {
    throw badRequest(`Jabatan "${input.name}" sudah ada`);
  }
  const id = await insertPosition({
    name: input.name,
    grade: input.grade ?? null,
    is_active: input.is_active === false ? 0 : 1,
  });
  return { id };
};

export const updatePositionById = async (
  id: number,
  input: { name?: string; grade?: string; is_active?: boolean },
) => {
  const existing = await findPositionById(id);
  if (!existing) throw notFound('Jabatan tidak ditemukan');
  if (input.name && input.name !== existing.name && (await findPositionByName(input.name))) {
    throw badRequest(`Jabatan "${input.name}" sudah ada`);
  }
  const patch: { name?: string; grade?: string | null; is_active?: number } = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.grade !== undefined) patch.grade = input.grade;
  if (input.is_active !== undefined) patch.is_active = input.is_active ? 1 : 0;
  await updatePosition(id, patch);
  return { id };
};

export const removePosition = async (id: number) => {
  if (!(await findPositionById(id))) throw notFound('Jabatan tidak ditemukan');
  await deletePosition(id);
};

