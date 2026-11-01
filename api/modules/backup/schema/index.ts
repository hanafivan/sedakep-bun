import { z } from '@hono/zod-openapi';

/** Backup & restore database — admin saja. */

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

export const RestoreBackupInputSchema = z
  .object({
    filename: z.string().min(1),
    confirm: z.string(),
  })
  .openapi('RestoreBackupInput');

export const BackupFileListResponseSchema = z.array(BackupFileSchema).openapi('BackupFileListResponse');
export const BackupRestoreResponseSchema = z.object({ filename: z.string() }).openapi('BackupRestoreResponse');

