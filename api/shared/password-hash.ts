import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Verifikasi password user dengan dukungan hash legacy MD5.
 *
 * Legacy sedakep menyimpan `MD5(password)` (32 hex). Hash itu tidak bisa
 * diperkuat, jadi strateginya: verifikasi MD5 apa adanya supaya user lama tetap
 * bisa login, lalu tandai `must_rehash` agar saat login berikutnya (atau saat
 * ganti password) otomatis dipindah ke Argon2id.
 */

export type PasswordAlgo = 'md5' | 'bcrypt' | 'argon2id';

export const hashPassword = async (plain: string): Promise<string> =>
  Bun.password.hash(plain, { algorithm: 'argon2id', memoryCost: 19_456, timeCost: 2 });

export const md5Hex = (plain: string): string =>
  createHash('md5').update(plain, 'utf8').digest('hex');

/** Bandingkan dua hex dengan waktu konstan. */
const safeEqualHex = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a.toLowerCase(), 'utf8');
  const bufferB = Buffer.from(b.toLowerCase(), 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
};

export const verifyPassword = async (
  plain: string,
  storedHash: string,
  algo: PasswordAlgo,
): Promise<boolean> => {
  if (!storedHash) return false;

  switch (algo) {
    case 'md5':
      return safeEqualHex(md5Hex(plain), storedHash);
    case 'bcrypt':
      return Bun.password.verify(plain, storedHash);
    case 'argon2id':
      return Bun.password.verify(plain, storedHash);
    default:
      return false;
  }
};

/** Password legacy masih md5 → harus di-hash ulang ke argon2id. */
export const needsRehash = (algo: PasswordAlgo): boolean => algo !== 'argon2id';

/** Deteksi algo dari bentuk hash, untuk import data legacy. */
export const detectAlgo = (storedHash: string): PasswordAlgo => {
  if (/^[a-f0-9]{32}$/i.test(storedHash)) return 'md5';
  if (/^\$2[aby]\$/.test(storedHash)) return 'bcrypt';
  return 'argon2id';
};
