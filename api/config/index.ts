import { z } from 'zod';

/**
 * Satu-satunya tempat membaca process.env.
 * Modul lain wajib import `config` dari sini, bukan menyentuh process.env.
 */

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().default(':memory:'),

  JWT_SECRET: z.string().min(1),

  BASIC_AUTH_USERNAME: z.string().min(1).default('admin'),
  // Salah satu harus ada. Hash lebih diutamakan daripada plaintext.
  BASIC_AUTH_PASSWORD: z.string().optional(),
  BASIC_AUTH_PASSWORD_HASH: z.string().optional(),
  BASIC_AUTH_SALT: z.string().min(1).default('dev-salt-ganti-di-produksi'),
  BASIC_AUTH_ITERATIONS: z.coerce.number().int().positive().default(100_000),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join(', ');
  throw new Error(`Konfigurasi environment tidak valid -> ${details}`);
}

const env = parsed.data;

if (isProduction) {
  if (!env.BASIC_AUTH_PASSWORD_HASH) {
    throw new Error(
      'Produksi wajib memakai BASIC_AUTH_PASSWORD_HASH (jalankan: bun run hash:basic-auth <password>)',
    );
  }
  if (env.BASIC_AUTH_SALT === 'dev-salt-ganti-di-produksi') {
    throw new Error('Produksi wajib mengisi BASIC_AUTH_SALT sendiri');
  }
}

export const config = {
  nodeEnv: env.NODE_ENV,
  isProduction,
  port: env.PORT,
  dbPath: env.DB_PATH,

  jwt: {
    secret: env.JWT_SECRET,
    algorithm: 'HS256' as const,
    expiresInSeconds: 60 * 60,
  },

  basicAuth: {
    username: env.BASIC_AUTH_USERNAME,
    /** Plaintext hanya untuk development. */
    plaintextPassword: env.BASIC_AUTH_PASSWORD ?? (isProduction ? undefined : 'admin'),
    /** Hash PBKDF2 (base64). Diutamakan kalau ada. */
    passwordHash: env.BASIC_AUTH_PASSWORD_HASH,
    salt: env.BASIC_AUTH_SALT,
    iterations: env.BASIC_AUTH_ITERATIONS,
  },
} as const;

export type AppConfig = typeof config;
