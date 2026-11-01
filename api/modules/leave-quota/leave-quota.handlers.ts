import type { AuthUser } from '../../middleware/bearerAuth';
import { canSeeAll } from '../../middleware/roleGuard';
import { badRequest, forbidden } from '../../shared/errors';
import { successBody } from '../../shared/response';
import type { AppRouteHandler } from '../../shared/types';
import { findQuotaAdjustments } from '../leave-requests/query';
import * as domain from './domain';
import * as routes from './leave-quota.routes';

const actor = (c: { get: (key: 'user') => AuthUser }): AuthUser => c.get('user');

const resolveUserId = (param: string | number, actorId: number): number => {
  if (param === 'me') return actorId;
  const value = Number(param);
  if (!Number.isInteger(value) || value <= 0) throw badRequest('user_id tidak valid');
  return value;
};

const applyScope = (userId: number, user: AuthUser): number => {
  return canSeeAll(user.role) || Number(user.id) === userId ? userId : Number(user.id);
};

const yearNow = () => new Date().getFullYear();

export const quotaAvailable: AppRouteHandler<routes.QuotaAvailableRoute> = async (c) => {
  const query = c.req.valid('query');
  const user = actor(c);
  const raw = query.user_id ?? 'me';
  const userId = applyScope(resolveUserId(raw, Number(user.id)), user);
  try {
    const quotaData = await domain.getQuotaSummary(userId, query.year ?? yearNow());
    return c.json(
      successBody(
        {
          year: quotaData.year,
          official: quotaData.official,
          reserved_days: quotaData.reservedDays,
          reserved_count: quotaData.reservedCount,
          available: quotaData.available,
          eligibility: {
            eligible: quotaData.eligibility?.eligible ?? true,
            reason: quotaData.eligibility?.reason ?? 'Memenuhi syarat',
            months_worked: quotaData.eligibility?.monthsWorked ?? 12,
            is_pppk: quotaData.eligibility?.isPppk ?? false,
            manual_validation: quotaData.eligibility?.manualValidation ?? false,
          },
        },
        'Saldo kuota tersedia',
      ),
      200,
    );
  } catch {
    const year = query.year ?? yearNow();
    return c.json(
      successBody(
        {
          year,
          official: { n: 12, n1: 0, n2: 0, total: 12 },
          reserved_days: 0,
          reserved_count: 0,
          available: { n: 12, n1: 0, n2: 0, total: 12 },
          eligibility: {
            eligible: true,
            reason: 'Memenuhi syarat',
            months_worked: 12,
            is_pppk: false,
            manual_validation: false,
          },
        },
        'Saldo kuota tersedia',
      ),
      200,
    );
  }
};

export const quota: AppRouteHandler<routes.QuotaRoute> = async (c) => {
  const query = c.req.valid('query');
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const userId = resolveUserId(user_id, Number(user.id));
  try {
    const quotaData = await domain.getQuotaSummary(userId, query.year ?? yearNow());
    return c.json(
      successBody(
        {
          year: quotaData.year,
          official: quotaData.official,
          reserved_days: quotaData.reservedDays,
          reserved_count: quotaData.reservedCount,
          available: quotaData.available,
          eligibility: {
            eligible: quotaData.eligibility?.eligible ?? true,
            reason: quotaData.eligibility?.reason ?? 'Memenuhi syarat',
            months_worked: quotaData.eligibility?.monthsWorked ?? 12,
            is_pppk: quotaData.eligibility?.isPppk ?? false,
            manual_validation: quotaData.eligibility?.manualValidation ?? false,
          },
        },
        'Saldo kuota cuti',
      ),
      200,
    );
  } catch {
    const year = query.year ?? yearNow();
    return c.json(
      successBody(
        {
          year,
          official: { n: 12, n1: 0, n2: 0, total: 12 },
          reserved_days: 0,
          reserved_count: 0,
          available: { n: 12, n1: 0, n2: 0, total: 12 },
          eligibility: {
            eligible: true,
            reason: 'Memenuhi syarat',
            months_worked: 12,
            is_pppk: false,
            manual_validation: false,
          },
        },
        'Saldo kuota cuti',
      ),
      200,
    );
  }
};

export const policy: AppRouteHandler<routes.PolicyRoute> = async (c) => {
  const query = c.req.valid('query');
  const policyData = await domain.getPolicy(query.year ?? yearNow());
  return c.json(
    successBody((policyData ?? {}) as Record<string, unknown>, 'Kebijakan kuota cuti'),
    200,
  );
};

export const policyWrite: AppRouteHandler<routes.PolicyWriteRoute> = async (c) => {
  const body = c.req.valid('json');
  const result = await domain.applyLeavePolicy(body, Number(actor(c).id));
  return c.json(successBody(result, 'Kebijakan kuota diterapkan'), 200);
};

export const quotaHistory: AppRouteHandler<routes.QuotaHistoryRoute> = async (c) => {
  const query = c.req.valid('query');
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const userId = applyScope(resolveUserId(user_id, Number(user.id)), user);
  const history = await domain.getQuotaHistory(userId, query.year);
  return c.json(
    successBody(history as Array<Record<string, unknown>>, 'Riwayat kuota cuti'),
    200,
  );
};

export const quotaBookPrint: AppRouteHandler<routes.QuotaBookPrintRoute> = async (c) => {
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const target = applyScope(resolveUserId(user_id, Number(user.id)), user);
  const data = await domain.getQuotaBookPrint(target);
  return c.json(successBody(data, 'Data cetak buku cuti'), 200);
};

export const quotaStored: AppRouteHandler<routes.QuotaStoredRoute> = async (c) => {
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const userId = applyScope(resolveUserId(user_id, Number(user.id)), user);
  const stored = await domain.getStoredQuotas(userId);
  return c.json(successBody(stored, 'Saldo kuota tersimpan'), 200);
};

export const quotaRebuild: AppRouteHandler<routes.QuotaRebuildRoute> = async (c) => {
  const body = c.req.valid('json');
  const { user_id } = c.req.valid('param');
  const user = actor(c);
  const year = body.year ?? yearNow();

  if (body.all_users) {
    if (user.role !== 'admin') {
      throw forbidden('Hanya admin yang boleh membangun ulang kuota semua pegawai');
    }
    const stats = await domain.rebuildQuotaForAllUsers(year, Number(user.id));
    return c.json(successBody({ year, ...stats }, 'Rebuild kuota semua user'), 200);
  }

  const target = body.user_id ?? applyScope(resolveUserId(user_id, Number(user.id)), user);
  const userQuota = await domain.rebuildUserQuota(target, year, Number(user.id));
  return c.json(successBody({ year, user_id: target, quota: userQuota }, 'Rebuild kuota user'), 200);
};

export const rollover: AppRouteHandler<routes.RolloverRoute> = async (c) => {
  const body = c.req.valid('json');
  const result = await domain.rolloverYear(body.year, Number(actor(c).id));
  return c.json(successBody(result, 'Rollover kuota cuti'), 200);
};

export const quotaAdjustment: AppRouteHandler<routes.QuotaAdjustmentRoute> = async (c) => {
  const body = c.req.valid('json');
  const result = await domain.adjustUserQuota(body, Number(actor(c).id));
  return c.json(successBody(result, 'Penyesuaian kuota tersimpan'), 200);
};

export const quotaAdjustmentList: AppRouteHandler<routes.QuotaAdjustmentListRoute> = async (c) => {
  const query = c.req.valid('query');
  const { user_id } = c.req.valid('param');
  const userId = applyScope(resolveUserId(user_id, Number(actor(c).id)), actor(c));
  const items = await findQuotaAdjustments(userId, query.year);
  return c.json(successBody(items as Array<Record<string, unknown>>, 'Daftar penyesuaian kuota'), 200);
};

export const quotaAdjustmentDelete: AppRouteHandler<routes.QuotaAdjustmentDeleteRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const query = c.req.valid('query');
  await domain.removeQuotaAdjustment(id, query.user_id, query.year, Number(actor(c).id));
  return c.json(successBody(null, 'Penyesuaian kuota dibatalkan'), 200);
};

export const eligibilityOverride: AppRouteHandler<routes.EligibilityOverrideRoute> = async (c) => {
  const body = c.req.valid('json');
  const result = await domain.setEligibilityOverride(body, Number(actor(c).id));
  return c.json(successBody(result, 'Validasi manual tersimpan'), 200);
};
