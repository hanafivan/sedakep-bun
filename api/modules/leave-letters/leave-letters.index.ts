import { OpenAPIHono } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import type { AppEnv } from '../../shared/types';
import * as handlers from './leave-letters.handlers';
import * as routes from './leave-letters.routes';

const app = new OpenAPIHono<AppEnv>({ defaultHook });

/**
 * Route modul surat keterangan cuti (leave-letters).
 *
 * Semua endpoint wajib login (bearerAuth) dan hanya bisa diakses oleh verifikator/atasan/admin.
 */
for (const prefix of [
  '/leave/letters',
  '/leave/letters/*',
  '/leave-requests/*/letters',
  '/leave-requests/*/letters/*',
]) {
  app.use(prefix, bearerAuth);
  app.use(prefix, requireRole('verifikator', 'atasan'));
}

export const leaveLettersRoutes = app
  .openapi(routes.lettersList, handlers.lettersList)
  .openapi(routes.requestLetters, handlers.requestLetters)
  .openapi(routes.issueLetter, handlers.issueLetter)
  .openapi(routes.letterFile, handlers.letterFile)
  .openapi(routes.revokeLetter, handlers.revokeLetter);

