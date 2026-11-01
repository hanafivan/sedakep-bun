import { OpenAPIHono } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import type { AppEnv } from '../../shared/types';
import * as handlers from './leave-requests.handlers';
import * as routes from './leave-requests.routes';

const app = new OpenAPIHono<AppEnv>({ defaultHook });

/**
 * Route modul cuti — boundary HTTP saja.
 *
 * Semua endpoint wajib login. Middleware di-scope ke prefix modul ini saja:
 * `use('*')` pada instance yang di-mount di `/api/v1` akan menelan seluruh
 * API dan mengubah 404 menjadi 401 untuk path yang tidak dikenal.
 */
for (const prefix of ['/leave', '/leave/*', '/leave-requests', '/leave-requests/*']) {
  app.use(prefix, bearerAuth);
}

/** Keputusan approval hanya untuk admin/verifikator/atasan. */
for (const prefix of ['/leave-requests/*/approve/*', '/leave-requests/*/cancel']) {
  app.use(prefix, requireRole('verifikator', 'atasan'));
}

export const leaveRequestsRoutes = app
  .openapi(routes.listLeaveRequests, handlers.listLeaveRequests)
  .openapi(routes.approvalSummary, handlers.approvalSummary)
  .openapi(routes.leaveStatistics, handlers.leaveStatistics)
  .openapi(routes.leaveTypeOptions, handlers.leaveTypeOptions)
  .openapi(routes.approverSuggestions, handlers.approverSuggestions)
  .openapi(routes.getLeaveRequest, handlers.getLeaveRequest)
  .openapi(routes.generateLeavePdf, handlers.generateLeavePdf)
  .openapi(routes.generateLeaveFormPdf, handlers.generateLeaveFormPdf)
  .openapi(routes.createLeaveRequest, handlers.createLeaveRequest)
  .openapi(routes.updateLeaveRequest, handlers.updateLeaveRequest)
  .openapi(routes.deleteLeaveRequest, handlers.deleteLeaveRequest)
  .openapi(routes.approveAdmin, handlers.approveAdmin)
  .openapi(routes.approveLevel, handlers.approveLevel)
  .openapi(routes.cancelLeave, handlers.cancelLeave)
  .openapi(routes.leaveLegacyHistory, handlers.leaveLegacyHistory);

export const leaveRoutes = leaveRequestsRoutes;

