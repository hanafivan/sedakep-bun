/**
 * AppError: satu-satunya cara service meng-signal error.
 *
 * Handler Hono yang catch ini di app.onError supaya response-nya konsisten.
 * Tidak perlu return { err, data } lagi.
 */
export type ErrorCode =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'INTERNAL';

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;

  constructor(code: ErrorCode, message: string, httpStatus = 500) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'AppError';
  }
}

/** Helper cepat */
export const badRequest  = (msg: string) => new AppError('VALIDATION', msg, 422);
export const unauthorized = (msg = 'Unauthorized') => new AppError('UNAUTHORIZED', msg, 401);
export const conflict    = (msg: string) => new AppError('CONFLICT', msg, 409);
export const notFound    = (msg: string) => new AppError('NOT_FOUND', msg, 404);
export const forbidden   = (msg = 'Forbidden') => new AppError('FORBIDDEN', msg, 403);