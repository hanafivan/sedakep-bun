import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '../../config';
import { basicAuth } from '../../middleware/basicAuth';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import { adminStatusRoute } from '../user/schema';

export const adminRoutes = new OpenAPIHono({ defaultHook });

adminRoutes.use('*', basicAuth);

adminRoutes.openapi(adminStatusRoute, (c) => c.json(successBody({
  status: 'operational',
  environment: config.nodeEnv,
}, '', 200), 200));
