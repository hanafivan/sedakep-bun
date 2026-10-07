import { OpenAPIHono } from '@hono/zod-openapi';
import { config } from '../../config';
import { getDb } from '../../db';
import { bearerAuth } from '../../middleware/bearerAuth';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import { loginRoute, meRoute, registerRoute } from './schema';
import { UserService } from './service';

export const userRoutes = new OpenAPIHono({ defaultHook });

const service = () => new UserService(getDb(), config.jwt.secret);

userRoutes.openapi(registerRoute, async (c) => {
  await service().register(c.req.valid('json'));
  return c.json(successBody(null, 'User berhasil didaftarkan', 200), 200);
});

userRoutes.openapi(loginRoute, async (c) => {
  const result = await service().login(c.req.valid('json'));
  return c.json(successBody(result, 'Login berhasil', 200), 200);
});

userRoutes.use('/me', bearerAuth);

userRoutes.openapi(meRoute, (c) => {
  const user = service().getById(c.get('user').id);
  return c.json(successBody(user, 'Data user berhasil diambil', 200), 200);
});
