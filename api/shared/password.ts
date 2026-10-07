import { timingSafeEqual } from 'node:crypto';

/**
 * Turunan kunci PBKDF2 + salt.
 *
 * Dipakai Basic Auth. Salt diambil dari config, bukan hardcode, supaya
 * kredensial yang sama menghasilkan hash berbeda antar environment.
 */

const encoder = new TextEncoder();

export const derivePasswordHash = async (
  password: string,
  salt: string,
  iterations: number,
): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations, hash: 'SHA-256' },
    key,
    256,
  );

  return Buffer.from(bits).toString('base64');
};

/** Perbandingan konstan waktu supaya tidak bisa ditebak dari selisih waktu. */
export const verifyPasswordHash = async (
  password: string,
  expectedHash: string,
  salt: string,
  iterations: number,
): Promise<boolean> => {
  const actual = Buffer.from(
    await derivePasswordHash(password, salt, iterations),
    'base64',
  );
  const expected = Buffer.from(expectedHash, 'base64');

  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
};
