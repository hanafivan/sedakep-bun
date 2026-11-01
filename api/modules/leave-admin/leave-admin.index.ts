import { OpenAPIHono } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import type { AppEnv } from '../../shared/types';
import * as handlers from './leave-admin.handlers';
import * as routes from './leave-admin.routes';

const app = new OpenAPIHono<AppEnv>({ defaultHook });

/**
 * Route modul administrasi cuti (leave-admin).
 *
 * Semua endpoint wajib login (bearerAuth) dan khusus admin.
 */
for (const prefix of ['/leave/admin', '/leave/admin/*']) {
  app.use(prefix, bearerAuth);
  app.use(prefix, requireRole('admin'));
}

export const leaveAdminRoutes = app
  .openapi(routes.instanceProfile, handlers.instanceProfile)
  .openapi(routes.instanceProfileWrite, handlers.instanceProfileWrite)
  .openapi(routes.closurePeriodsList, handlers.closurePeriodsList)
  .openapi(routes.createClosurePeriod, handlers.createClosurePeriod)
  .openapi(routes.updateClosurePeriod, handlers.updateClosurePeriod)
  .openapi(routes.deleteClosurePeriod, handlers.deleteClosurePeriod)
  .openapi(routes.quotaBook, handlers.quotaBook)
  .openapi(routes.userDirectory, handlers.userDirectory)
  .openapi(routes.quotaAuditTrail, handlers.quotaAuditTrail)
  .openapi(routes.pppkTmt, handlers.pppkTmt)
  .openapi(routes.pppkTmtWrite, handlers.pppkTmtWrite)
  .openapi(routes.leaveYearlySummary, handlers.leaveYearlySummary)
  .openapi(routes.leaveExport, handlers.leaveExport);

