import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

/**
 * Response wrapper seragam — warisan codebase-2pai yang tetap dipakai.
 *
 * Bentuk sukses : { success: true,  data, message, code }
 * Bentuk gagal  : { success: false, data: null, message, code, details? }
 */

export const successBody = <T>(data: T, message = '', code = 200) => ({
  success: true as const,
  data,
  message,
  code,
});

export const failBody = (message: string, code = 500, details?: unknown) => ({
  success: false as const,
  data: null,
  message,
  code,
  details,
});

export const successResponse = <T>(
  c: Context,
  data: T,
  message = '',
  code = 200,
) => c.json(successBody(data, message, code), code as ContentfulStatusCode);

export const failResponse = (
  c: Context,
  message: string,
  code = 500,
  details?: unknown,
) =>
  c.json(
    failBody(message, code, details),
    code as ContentfulStatusCode,
  );
