import { OpenAPIHono } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { defaultHook } from '../../shared/openapi-hook';
import { successBody } from '../../shared/response';
import { navigationBadgesRoute } from './schema';
import * as service from './service';

/** Route navigasi — boundary HTTP untuk badge sidebar. */

export const navigationRoutes = new OpenAPIHono({ defaultHook });

navigationRoutes.use('/navigation/*', bearerAuth);
navigationRoutes.use('/badges', bearerAuth);

navigationRoutes.openapi(navigationBadgesRoute, async (c) => {
  const badges = await service.getNavigationBadges(c.get('user'));
  return c.json(successBody(badges, 'Angka badge navigasi'), 200);
});

// Alias langsung untuk /badges
navigationRoutes.get('/badges', async (c) => {
  const badges = await service.getNavigationBadges(c.get('user'));
  return c.json(successBody(badges, 'Angka badge navigasi'), 200);
});
