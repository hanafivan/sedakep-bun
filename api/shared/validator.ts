import { zValidator as zv } from '@hono/zod-validator';
import type { ZodSchema } from 'zod';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Bungkus @hono/zod-validator supaya error validasi:
 *  - status 422 (default library-nya 400)
 *  - body memakai bentuk wrapper yang sama dengan error lain
 *
 * Pemakaian sama: zValidator('json', Schema)
 */
export const zValidator = <
  Target extends Parameters<typeof zv>[0],
  Schema extends ZodSchema,
>(
  target: Target,
  schema: Schema,
) =>
  zv(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          data: null,
          message: 'Validasi gagal',
          code: 422,
          details: result.error.flatten().fieldErrors,
        },
        422 as ContentfulStatusCode,
      );
    }
  });
