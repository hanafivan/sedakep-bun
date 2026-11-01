import { z } from '@hono/zod-openapi';

/** Master data: organisasi/unit kerja dan jabatan. */

export const OrganizationSchema = z
  .object({
    id: z.number(),
    code: z.string(),
    name: z.string(),
    parent_id: z.number().nullable(),
    level: z.number(),
    is_active: z.number(),
  })
  .openapi('Organization');

export const PositionSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    grade: z.string().nullable(),
    is_active: z.number(),
  })
  .openapi('Position');

export const OrganizationInputSchema = z
  .object({
    code: z.string().min(1).max(50),
    name: z.string().min(1).max(150),
    parent_id: z.number().int().positive().nullable().optional(),
    level: z.number().int().min(0).max(20).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('OrganizationInput');

export const PositionInputSchema = z
  .object({
    name: z.string().min(1).max(150),
    grade: z.string().max(20).optional(),
    is_active: z.boolean().optional(),
  })
  .openapi('PositionInput');

export const IdParamSchema = z.object({ id: z.coerce.number().int().positive() });

export const MasterQuerySchema = z.object({
  search: z.string().optional(),
  active_only: z.string().optional(),
});

export const OrganizationListResponseSchema = z.array(OrganizationSchema).openapi('OrganizationListResponse');
export const OrganizationCreateResponseSchema = z.record(z.any()).openapi('OrganizationCreateResponse');
export const OrganizationUpdateResponseSchema = z.record(z.any()).openapi('OrganizationUpdateResponse');
export const PositionListResponseSchema = z.array(PositionSchema).openapi('PositionListResponse');
export const PositionCreateResponseSchema = z.record(z.any()).openapi('PositionCreateResponse');
export const PositionUpdateResponseSchema = z.record(z.any()).openapi('PositionUpdateResponse');

