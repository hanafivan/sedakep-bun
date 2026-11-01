import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import { json, okResponse } from '../../shared/openapi';
import { GET_SYSTEM_METHOD, POST_SYSTEM_METHOD } from '../../shared/constant';
import { successBody } from '../../shared/response';
import {
  BackupFileListResponseSchema,
  BackupRestoreResponseSchema,
  BackupResultSchema,
  RestoreBackupInputSchema,
} from './schema';
import * as domain from './domain';

/** Route backup/restore — admin saja. */

export const backupRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/system/backups', '/system/backups/*']) {
  backupRoutes.use(prefix, bearerAuth, requireRole('admin'));
}

const listBackupsRoute = createRoute({
  ...GET_SYSTEM_METHOD,
  path: '/system/backups',
  summary: 'Daftar berkas backup (admin)',
  responses: okResponse(BackupFileListResponseSchema, 'Daftar berkas backup', 'BackupFileListResponse'),
});

const createBackupRoute = createRoute({
  ...POST_SYSTEM_METHOD,
  path: '/system/backups',
  summary: 'Buat backup database (admin)',
  responses: okResponse(BackupResultSchema, 'Backup dibuat', 'BackupCreateResponse'),
});

const restoreBackupRoute = createRoute({
  ...POST_SYSTEM_METHOD,
  path: '/system/backups/restore',
  summary: 'Restore database dari berkas backup (admin, wajib konfirmasi)',
  request: {
    body: json(RestoreBackupInputSchema),
  },
  responses: okResponse(BackupRestoreResponseSchema, 'Restore dijalankan', 'BackupRestoreResponse'),
});

backupRoutes.openapi(listBackupsRoute, async (c) => {
  const items = await domain.listBackups();
  return c.json(successBody(items, 'Daftar berkas backup'), 200);
});

backupRoutes.openapi(createBackupRoute, async (c) => {
  const result = await domain.createBackup();
  return c.json(successBody(result, 'Backup database dibuat'), 200);
});

backupRoutes.openapi(restoreBackupRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await domain.restoreBackup(body.filename, body.confirm);
  return c.json(successBody(result, 'Restore database dijalankan'), 200);
});
