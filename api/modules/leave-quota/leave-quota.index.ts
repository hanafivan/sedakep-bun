import { OpenAPIHono } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { requireRole } from '../../middleware/roleGuard';
import { defaultHook } from '../../shared/openapi-hook';
import type { AppEnv } from '../../shared/types';
import * as handlers from './leave-quota.handlers';
import * as routes from './leave-quota.routes';

const app = new OpenAPIHono<AppEnv>({ defaultHook });

/**
 * Route modul kuota cuti (leave-quota).
 *
 * Semua endpoint wajib login (bearerAuth).
 */
for (const prefix of ['/leave/quota', '/leave/quota/*', '/leave/policy']) {
  app.use(prefix, bearerAuth);
}

/** Operasi kebijakan, rollover, dan adjustment hanya admin. */
app.use('/leave/policy', requireRole('admin'));
app.use('/leave/quota/rollover', requireRole('admin'));
app.use('/leave/quota/adjustment', requireRole('admin'));
app.use('/leave/quota/adjustment/*', requireRole('admin'));
app.use('/leave/quota/eligibility-override', requireRole('admin'));

export const leaveQuotaRoutes = app
  .openapi(routes.quotaAvailable, handlers.quotaAvailable)
  .openapi(routes.quota, handlers.quota)
  .openapi(routes.policy, handlers.policy)
  .openapi(routes.policyWrite, handlers.policyWrite)
  .openapi(routes.quotaHistory, handlers.quotaHistory)
  .openapi(routes.quotaBookPrint, handlers.quotaBookPrint)
  .openapi(routes.quotaStored, handlers.quotaStored)
  .openapi(routes.quotaRebuild, handlers.quotaRebuild)
  .openapi(routes.rollover, handlers.rollover)
  .openapi(routes.quotaAdjustment, handlers.quotaAdjustment)
  .openapi(routes.quotaAdjustmentList, handlers.quotaAdjustmentList)
  .openapi(routes.quotaAdjustmentDelete, handlers.quotaAdjustmentDelete)
  .openapi(routes.eligibilityOverride, handlers.eligibilityOverride);

