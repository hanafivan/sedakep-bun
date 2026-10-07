import type { Hook } from '@hono/zod-openapi';
import { failBody } from './response';

/**
 * Hook validasi default untuk OpenAPIHono.
 *
 * Tanpa ini, @hono/zod-openapi mengembalikan 400 dengan bentuk body sendiri.
 * Dengan hook ini, error validasi memakai status 422 dan bentuk wrapper yang
 * sama dengan error lain di aplikasi.
 */
export const defaultHook: Hook<any, any, any, any> = (result, c) => {
  if (result.success) return;

  return c.json(
    failBody('Validasi gagal', 422, result.error.flatten().fieldErrors),
    422,
  );
};
