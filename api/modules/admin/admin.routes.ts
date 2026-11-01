import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { config } from '../../config';
import { basicAuth } from '../../middleware/basicAuth';
import { defaultHook } from '../../shared/openapi-hook';
import { errors, okResponse } from '../../shared/openapi';
import { GET_ADMIN_METHOD } from '../../shared/constant';
import { successBody } from '../../shared/response';
import { AdminStatusResponseSchema } from '../user/schema';

export const adminRoutes = new OpenAPIHono({ defaultHook });

adminRoutes.use('*', basicAuth);

const adminStatusRoute = createRoute({
  ...GET_ADMIN_METHOD,
  path: '/status',
  summary: 'Status sistem (Basic Auth)',
  responses: {
    ...okResponse(AdminStatusResponseSchema, 'Status sistem', 'AdminStatusResponse'),
    ...errors({ 401: 'Basic auth gagal' }),
  },
});

adminRoutes.openapi(adminStatusRoute, (c) => c.json(successBody({
  status: 'operational',
  environment: config.nodeEnv,
}, '', 200), 200));
