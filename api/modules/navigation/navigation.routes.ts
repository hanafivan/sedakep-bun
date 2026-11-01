import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { bearerAuth } from '../../middleware/bearerAuth';
import { defaultHook } from '../../shared/openapi-hook';
import { okResponse } from '../../shared/openapi';
import { GET_NAVIGATION_METHOD } from '../../shared/constant';
import { successBody } from '../../shared/response';
import { NavigationBadgesSchema } from './schema';
import * as domain from './domain';

/** Route navigasi — boundary HTTP untuk badge sidebar. */

export const navigationRoutes = new OpenAPIHono({ defaultHook });

navigationRoutes.use('/navigation/*', bearerAuth);
navigationRoutes.use('/badges', bearerAuth);

const navigationBadgesRoute = createRoute({
  ...GET_NAVIGATION_METHOD,
  path: '/navigation/badges',
  summary: 'Angka badge navigasi (disposisi, persetujuan cuti, sisa kuota)',
  responses: okResponse(NavigationBadgesSchema, 'Angka badge navigasi', 'NavigationBadgesResponse'),
});

navigationRoutes.openapi(navigationBadgesRoute, async (c) => {
  const badges = await domain.getNavigationBadges(c.get('user'));
  return c.json(successBody(badges, 'Angka badge navigasi'), 200);
});

// Alias langsung untuk /badges
navigationRoutes.get('/badges', async (c) => {
  const badges = await domain.getNavigationBadges(c.get('user'));
  return c.json(successBody(badges, 'Angka badge navigasi'), 200);
});
