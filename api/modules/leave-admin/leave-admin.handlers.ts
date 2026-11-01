import type { AuthUser } from '../../middleware/bearerAuth';
import { successBody } from '../../shared/response';
import type { AppRouteHandler } from '../../shared/types';
import * as domain from './domain';
import * as routes from './leave-admin.routes';

const actor = (c: { get: (key: 'user') => AuthUser }): AuthUser => c.get('user');
const yearNow = () => new Date().getFullYear();

export const instanceProfile: AppRouteHandler<routes.InstanceProfileRoute> = async (c) => {
  const profile = await domain.getInstanceProfile();
  return c.json(successBody(profile ?? {}, 'Identitas instansi'), 200);
};

export const instanceProfileWrite: AppRouteHandler<routes.InstanceProfileWriteRoute> = async (c) => {
  const body = c.req.valid('json');
  const result = await domain.updateInstanceProfile(body, Number(actor(c).id));
  return c.json(successBody(result, 'Identitas instansi tersimpan'), 200);
};

export const closurePeriodsList: AppRouteHandler<routes.ClosurePeriodsListRoute> = async (c) => {
  const periods = await domain.listClosurePeriods();
  return c.json(successBody(periods as Array<Record<string, unknown>>, 'Periode tutup cuti tahunan'), 200);
};

export const createClosurePeriod: AppRouteHandler<routes.CreateClosurePeriodRoute> = async (c) => {
  const body = c.req.valid('json');
  const result = await domain.createClosurePeriod(body, Number(actor(c).id));
  return c.json(successBody(result, 'Periode tutup cuti dibuat'), 200);
};

export const updateClosurePeriod: AppRouteHandler<routes.UpdateClosurePeriodRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const result = await domain.updateClosurePeriodById(id, body, Number(actor(c).id));
  return c.json(successBody(result, 'Periode tutup cuti diubah'), 200);
};

export const deleteClosurePeriod: AppRouteHandler<routes.DeleteClosurePeriodRoute> = async (c) => {
  const { id } = c.req.valid('param');
  await domain.removeClosurePeriod(id, Number(actor(c).id));
  return c.json(successBody(null, 'Periode tutup cuti dihapus'), 200);
};

export const quotaBook: AppRouteHandler<routes.QuotaBookRoute> = async (c) => {
  const query = c.req.valid('query');
  const book = await domain.getQuotaBook(query.year ?? yearNow(), query);
  return c.json(successBody(book, 'Buku cuti'), 200);
};

export const userDirectory: AppRouteHandler<routes.UserDirectoryRoute> = async (c) => {
  const query = c.req.valid('query');
  const directory = await domain.listUsers(query);
  return c.json(successBody(directory, 'Daftar pegawai'), 200);
};

export const quotaAuditTrail: AppRouteHandler<routes.QuotaAuditTrailRoute> = async (c) => {
  const query = c.req.valid('query');
  const trail = await domain.getQuotaAuditTrail(query);
  return c.json(successBody(trail as Array<Record<string, unknown>>, 'Audit trail kuota'), 200);
};

export const pppkTmt: AppRouteHandler<routes.PppkTmtRoute> = async (c) => {
  const summary = await domain.getPppkTmtSummary();
  return c.json(successBody(summary, 'Daftar TMT PPPK'), 200);
};

export const pppkTmtWrite: AppRouteHandler<routes.PppkTmtWriteRoute> = async (c) => {
  const body = c.req.valid('json');
  const result = await domain.setPppkTmt(body, Number(actor(c).id));
  return c.json(successBody(result, 'TMT PPPK tersimpan'), 200);
};

export const leaveYearlySummary: AppRouteHandler<routes.LeaveYearlySummaryRoute> = async (c) => {
  const summary = await domain.getLeaveYearlySummary();
  return c.json(successBody(summary, 'Rekap permohonan per tahun'), 200);
};

export const leaveExport: AppRouteHandler<routes.LeaveExportRoute> = async (c) => {
  const query = c.req.valid('query');
  const statuses: string[] | undefined = query.status
    ? query.status.split(',').map((value) => value.trim()).filter(Boolean)
    : undefined;

  const csv = await domain.exportLeaveRequestsCsv({
    dateFrom: query.date_from,
    dateTo: query.date_to,
    leaveType: query.leave_type,
    statuses,
    letterStatus: query.letter_status,
    search: query.search,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return c.body(csv, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename=permohonan_cuti_${stamp}.csv`,
  });
};

