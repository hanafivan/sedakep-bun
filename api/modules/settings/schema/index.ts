import { z } from '@hono/zod-openapi';

/** Pengaturan umum: tabel key/value `settings`. */

export const SettingSchema = z
  .object({
    key: z.string(),
    value: z.string().nullable(),
    description: z.string().nullable(),
    updated_at: z.string(),
    secret: z.boolean(),
    readonly: z.boolean(),
  })
  .openapi('Setting');

export const SettingInputSchema = z
  .object({
    value: z.string().max(65535).nullable(),
    description: z.string().max(255).nullable().optional(),
  })
  .openapi('SettingInput');

export const KeyParamSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(75)
    .regex(/^[a-z0-9_.:-]+$/, 'Kunci hanya boleh huruf kecil, angka, titik, garis, titik dua'),
});

export const SettingsQuerySchema = z.object({
  prefix: z.string().optional(),
  search: z.string().optional(),
});

export const SettingListResponseSchema = z.array(SettingSchema).openapi('SettingListResponse');

