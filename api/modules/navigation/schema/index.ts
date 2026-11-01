import { z } from '@hono/zod-openapi';

/** Ringkasan angka untuk badge sidebar navigasi. */

export const NavigationBadgesSchema = z
  .object({
    disposition_pending: z.number().int().nonnegative(),
    leave_pending: z.number().int().nonnegative(),
    quota_remaining_days: z.number().int(),
  })
  .openapi('NavigationBadges');
