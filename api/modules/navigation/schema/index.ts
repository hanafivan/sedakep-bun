import { z } from 'zod';
import { createRoute } from '@hono/zod-openapi';

/** Ringkasan angka untuk badge sidebar navigasi. */

export const NavigationBadgesSchema = z
  .object({
    disposition_pending: z.number().int().nonnegative(),
    leave_pending: z.number().int().nonnegative(),
    quota_remaining_days: z.number().int(),
  })
  .openapi('NavigationBadges');

export const navigationBadgesRoute = createRoute({
  method: 'get',
  path: '/navigation/badges',
  tags: ['Navigation'],
  summary: 'Angka badge navigasi (disposisi, persetujuan cuti, sisa kuota)',
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Angka badge navigasi',
      content: {
        'application/json': {
          schema: z
            .object({
              success: z.literal(true),
              data: NavigationBadgesSchema,
              message: z.string(),
              code: z.number(),
            })
            .openapi('NavigationBadgesResponse'),
        },
      },
    },
  },
});
