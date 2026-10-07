import { OpenAPIHono } from '@hono/zod-openapi';
import { swaggerUI } from '@hono/swagger-ui';
import { ZodError } from 'zod';
import { adminRoutes } from './modules/admin/admin.routes';
import { userRoutes } from './modules/user/user.routes';
import { mountOpenApi } from './docs/openapi';
import { AppError } from './shared/errors';
import { logger } from './shared/logger';
import { failBody, failResponse, successResponse } from './shared/response';

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
