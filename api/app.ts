import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { ZodError } from 'zod';
import { adminRoutes } from './modules/admin/admin.routes';
import { userRoutes } from './modules/user/user.routes';
import { mountOpenApi } from './docs/openapi';
import { assignmentRoutes } from './modules/assignments/assignments.routes';
import { alibiRoutes } from './modules/alibi/alibi.routes';
import { agendaRoutes } from './modules/agendas/agendas.routes';
import { backupRoutes } from './modules/backup/backup.routes';
import { dispositionRoutes } from './modules/dispositions/dispositions.routes';
import { navigationRoutes } from './modules/navigation/navigation.routes';
import { documentRoutes } from './modules/documents/documents.routes';
import { leaveRoutes } from './modules/leave/leave.routes';
import { masterRoutes } from './modules/master/master.routes';
import { serviceRequestRoutes } from './modules/service-requests/service-requests.routes';
import { settingsRoutes } from './modules/settings/settings.routes';
import { verifyRoutes } from './modules/verify/verify.routes';
import { bearerAuth } from './middleware/bearerAuth';
import { UserService } from './modules/user/service';
import { getNavigationBadges } from './modules/navigation/service';
import { config } from './config';
import { AppError } from './shared/errors';
import { logger } from './shared/logger';
import { failBody, failResponse, successBody, successResponse } from './shared/response';

export const app = new OpenAPIHono();

app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

app.openAPIRegistry.registerComponent('securitySchemes', 'basicAuth', {
  type: 'http',
  scheme: 'basic',
});

app.use('*', async (c, next) => {
  const startedAt = Date.now();
  await next();
  logger.info('request', `${c.req.method} ${c.req.path}`, {
    status: c.res.status,
    durationMs: Date.now() - startedAt,
  });
});

app.get('/health', (c) => successResponse(c, { status: 'ok' }));

// API
app.route('/api/v1/users', userRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1', leaveRoutes);
app.route('/api/v1', assignmentRoutes);
app.route('/api/v1', alibiRoutes);
app.route('/api/v1', agendaRoutes);
app.route('/api/v1', dispositionRoutes);
app.route('/api/v1', serviceRequestRoutes);
app.route('/api/v1', masterRoutes);
app.route('/api/v1', settingsRoutes);
app.route('/api/v1', documentRoutes);
app.route('/api/v1', navigationRoutes);
app.route('/api/v1', backupRoutes);

// Verifikasi publik dokumen cetak (dipindai dari QR) — di luar /api/v1,
// sekaligus di bawah /api/v1 agar SPA dapat memanggilnya lewat proxy.
app.route('/', verifyRoutes);
app.route('/api/v1', verifyRoutes);

// Endpoint alias /me dan /badges (mendukung baik rute root maupun /api/v1)
const handleMe = async (c: any) => {
  const userPayload = c.get('user');
  try {
    const user = await new UserService(config.jwt.secret, config.jwt.expiresInSeconds).getById(Number(userPayload.id));
    return c.json(successBody(user, 'Data user berhasil diambil', 200), 200);
  } catch {
    return c.json(
      successBody(
        {
          id: Number(userPayload.id),
          username: userPayload.username,
          role: userPayload.role,
        },
        'Data user berhasil diambil',
        200,
      ),
      200,
    );
  }
};

const handleBadges = async (c: any) => {
  const userPayload = c.get('user');
  const badges = await getNavigationBadges(userPayload);
  return c.json(successBody(badges, 'Angka badge navigasi'), 200);
};

app.get('/me', bearerAuth, handleMe);
app.get('/api/v1/me', bearerAuth, handleMe);
app.get('/badges', bearerAuth, handleBadges);
app.get('/api/v1/badges', bearerAuth, handleBadges);

// OpenAPI + Swagger UI
mountOpenApi(app);
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return failResponse(c, 'Endpoint tidak ditemukan', 404);
  }
  return c.json(failBody('Endpoint tidak ditemukan', 404), 404);
});

app.onError((error, c) => {
  if (error instanceof ZodError) {
    return failResponse(c, 'Validasi gagal', 422, error.flatten().fieldErrors);
  }

  if (error instanceof AppError) {
    return failResponse(c, error.message, error.httpStatus, { type: error.code });
  }

  logger.error('unhandled-error', error.message, { stack: error.stack });
  return failResponse(c, 'Terjadi kesalahan pada server', 500);
});
