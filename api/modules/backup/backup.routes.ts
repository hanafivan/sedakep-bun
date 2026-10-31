import { OpenAPIHono } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import { createBackupRoute, listBackupsRoute, restoreBackupRoute } from './schema';
import * as service from './service';

/** Route backup/restore — admin saja. */

export const backupRoutes = new OpenAPIHono({ defaultHook });

for (const prefix of ['/system/backups', '/system/backups/*']) {
  backupRoutes.use(prefix, bearerAuth, requireRole('admin'));
}

backupRoutes.openapi(listBackupsRoute, async (c) => {
  const items = await service.listBackups();
  return c.json(successBody(items, 'Daftar berkas backup'), 200);
});

backupRoutes.openapi(createBackupRoute, async (c) => {
  const result = await service.createBackup();
  return c.json(successBody(result, 'Backup database dibuat'), 200);
});

backupRoutes.openapi(restoreBackupRoute, async (c) => {
  const body = c.req.valid('json');
  const result = await service.restoreBackup(body.filename, body.confirm);
  return c.json(successBody(result, 'Restore database dijalankan'), 200);
});
