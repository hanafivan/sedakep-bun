import type { RouteConfig, RouteHandler } from '@hono/zod-openapi';
import type { AuthUser } from '../middleware/bearerAuth';

export type AppEnv = {
  Variables: {
    user: AuthUser;
  };
};

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppEnv>;

