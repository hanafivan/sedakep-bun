import { createMiddleware } from 'hono/factory';
import { config } from '../config';
import { unauthorized } from '../shared/errors';
import { logger } from '../shared/logger';
import { derivePasswordHash, verifyPasswordHash } from '../shared/password';

/**
 * Basic Auth untuk endpoint internal/admin.
 *
 * Password tidak dibandingkan sebagai plaintext. Yang dibandingkan adalah
 * hash PBKDF2 + salt (constant-time). Sumber hash, berurutan prioritas:
 *   1. config.basicAuth.passwordHash  (BASIC_AUTH_PASSWORD_HASH)
 *   2. turunan dari config.basicAuth.plaintextPassword (khusus development)
 */

let cachedExpectedHash: Promise<string> | null = null;

const getExpectedHash = (): Promise<string> => {
  if (config.basicAuth.passwordHash) {
    return Promise.resolve(config.basicAuth.passwordHash);
  }

  if (!cachedExpectedHash) {
    const { plaintextPassword, salt, iterations } = config.basicAuth;

    if (!plaintextPassword) {
      throw new Error('Basic Auth tidak punya password maupun hash');
    }

    if (!config.isProduction && salt === 'dev-salt-ganti-di-produksi') {
      logger.warn(
        'basic-auth',
        'Memakai salt default. Isi BASIC_AUTH_SALT sebelum deploy.',
      );
    }

    cachedExpectedHash = derivePasswordHash(plaintextPassword, salt, iterations);
  }

  return cachedExpectedHash;
};

export const basicAuth = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');

  if (!header?.startsWith('Basic ')) {
    throw unauthorized('Basic authentication required');
  }

  let username = '';
  let password = '';

  try {
    const decoded = atob(header.slice(6));
    const separator = decoded.indexOf(':');

    if (separator < 0) throw unauthorized('Invalid basic authentication');

    username = decoded.slice(0, separator);
    password = decoded.slice(separator + 1);
  } catch (error) {
    if (error instanceof Error && error.name === 'AppError') throw error;
    throw unauthorized('Invalid basic authentication');
  }

  const expectedHash = await getExpectedHash();
  const passwordValid = await verifyPasswordHash(
    password,
    expectedHash,
    config.basicAuth.salt,
    config.basicAuth.iterations,
  );

  if (username !== config.basicAuth.username || !passwordValid) {
    throw unauthorized('Invalid basic authentication');
  }

  await next();
});
