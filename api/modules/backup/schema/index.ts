import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

/** Backup & restore database — admin saja. */

const json = <T extends z.ZodTypeAny>(schema: T) => ({
  content: { 'application/json': { schema } },
});

export const BackupFileSchema = z
  .object({
    filename: z.string(),
    size_bytes: z.number().int().nonnegative(),
    created_at: z.string(),
  })
  .openapi('BackupFile');

export const BackupResultSchema = z
  .object({
    filename: z.string(),
    size_bytes: z.number().int().nonnegative(),
    documents: z.number().int().nonnegative(),
  })
  .openapi('BackupResult');

export const listBackupsRoute = createRoute({
  method: 'get',
  path: '/system/backups',
  tags: ['System'],
  summary: 'Daftar berkas backup (admin)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Daftar berkas backup',
      ...json(
        z.object({
          success: z.literal(true),
          data: z.array(BackupFileSchema),
          message: z.string(),
          code: z.number(),
        }),
      ),
    },
  },
});

export const createBackupRoute = createRoute({
  method: 'post',
  path: '/system/backups',
  tags: ['System'],
  summary: 'Buat backup database (admin)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Backup dibuat',
      ...json(
        z.object({
          success: z.literal(true),
          data: BackupResultSchema,
          message: z.string(),
          code: z.number(),
        }),
      ),
    },
  },
});

export const restoreBackupRoute = createRoute({
  method: 'post',
  path: '/system/backups/restore',
  tags: ['System'],
  summary: 'Restore database dari berkas backup (admin, wajib konfirmasi)',
  security: [{ bearerAuth: [] }],
  request: {
    body: json(
      z.object({
        filename: z.string().min(1),
        confirm: z.string(),
      }),
    ),
  },
  responses: {
    200: {
      description: 'Restore dijalankan',
      ...json(
        z.object({
          success: z.literal(true),
          data: z.object({ filename: z.string() }),
          message: z.string(),
          code: z.number(),
        }),
      ),
    },
  },
});
