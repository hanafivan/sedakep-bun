import { z } from 'zod';

/**
 * Satu-satunya tempat membaca process.env.
 * Modul lain wajib import `config` dari sini, bukan menyentuh process.env.
 */

const isProduction = (process.env.NODE_ENV ?? 'development') === 'production';

/** Nilai default yang gampang ditebak — dilarang di produksi. */
const INSECURE_DEFAULTS = {
  basicAuthSalt: 'dev-salt-ganti-di-produksi',
  jwtSecret: 'dev-secret-ganti-di-produksi',
  storageAccessKey: 'minioadmin',
  storageSecretKey: 'minioadmin123',
};

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_PATH: z.string().default(':memory:'),

  JWT_SECRET: z.string().min(1),

  BASIC_AUTH_USERNAME: z.string().min(1).default('admin'),
  // Salah satu harus ada. Hash lebih diutamakan daripada plaintext.
  BASIC_AUTH_PASSWORD: z.string().optional(),
  BASIC_AUTH_PASSWORD_HASH: z.string().optional(),
  BASIC_AUTH_SALT: z.string().min(1).default(INSECURE_DEFAULTS.basicAuthSalt),
  BASIC_AUTH_ITERATIONS: z.coerce.number().int().positive().default(100_000),

  // ---------- MySQL (database aplikasi) ----------
  MYSQL_HOST: z.string().min(1).default('127.0.0.1'),
  MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  MYSQL_USER: z.string().min(1).default('root'),
  MYSQL_PASSWORD: z.string().default(''),
  MYSQL_DATABASE: z.string().min(1).default('sedakep'),
  MYSQL_CONNECTION_LIMIT: z.coerce.number().int().positive().default(10),

  // ---------- MySQL legacy (sumber migrasi, read-only) ----------
  LEGACY_MYSQL_HOST: z.string().min(1).default('127.0.0.1'),
  LEGACY_MYSQL_PORT: z.coerce.number().int().positive().default(3306),
  LEGACY_MYSQL_USER: z.string().min(1).default('root'),
  LEGACY_MYSQL_PASSWORD: z.string().default(''),
  LEGACY_MYSQL_DATABASE: z.string().min(1).default('ptsp_sedakep'),

  // ---------- MinIO / S3 (penyimpanan dokumen) ----------
  STORAGE_DRIVER: z.enum(['minio', 'local']).default('minio'),
  STORAGE_ENDPOINT: z.string().url().default('http://127.0.0.1:9000'),
  STORAGE_REGION: z.string().min(1).default('us-east-1'),
  STORAGE_ACCESS_KEY: z.string().min(1).default(INSECURE_DEFAULTS.storageAccessKey),
  STORAGE_SECRET_KEY: z.string().min(1).default(INSECURE_DEFAULTS.storageSecretKey),
  STORAGE_BUCKET: z.string().min(1).default('sedakep-documents'),
  /** MinIO hampir selalu butuh path-style, bukan virtual-host style. */
  STORAGE_FORCE_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  STORAGE_LOCAL_ROOT: z.string().default('storage'),
  STORAGE_PRESIGN_TTL_SECONDS: z.coerce.number().int().positive().default(900),

  /** Basis URL publik untuk tautan verifikasi QR pada dokumen cetak. */
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:3000'),

  // ---------- Scheduler (rollover kuota tahunan) ----------
  SCHEDULER_TZ: z.string().min(1).default('Asia/Jakarta'),
  SCHEDULER_ROLLOVER_MONTH: z.coerce.number().int().min(1).max(12).default(1),
  SCHEDULER_ROLLOVER_DAY: z.coerce.number().int().min(1).max(31).default(1),
  SCHEDULER_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
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
  if (env.BASIC_AUTH_SALT === INSECURE_DEFAULTS.basicAuthSalt) {
    throw new Error('Produksi wajib mengisi BASIC_AUTH_SALT sendiri');
  }
  if (env.JWT_SECRET === INSECURE_DEFAULTS.jwtSecret) {
    throw new Error('Produksi wajib mengisi JWT_SECRET sendiri');
  }
  if (env.STORAGE_ACCESS_KEY === INSECURE_DEFAULTS.storageAccessKey) {
    throw new Error('Produksi wajib mengisi STORAGE_ACCESS_KEY sendiri');
  }
  if (env.STORAGE_SECRET_KEY === INSECURE_DEFAULTS.storageSecretKey) {
    throw new Error('Produksi wajib mengisi STORAGE_SECRET_KEY sendiri');
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
    /** 8 jam: satu shift kerja administrator/operator. */
    expiresInSeconds: 8 * 60 * 60,
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

  mysql: {
    host: env.MYSQL_HOST,
    port: env.MYSQL_PORT,
    user: env.MYSQL_USER,
    password: env.MYSQL_PASSWORD,
    database: env.MYSQL_DATABASE,
    connectionLimit: env.MYSQL_CONNECTION_LIMIT,
  },

  legacyMysql: {
    host: env.LEGACY_MYSQL_HOST,
    port: env.LEGACY_MYSQL_PORT,
    user: env.LEGACY_MYSQL_USER,
    password: env.LEGACY_MYSQL_PASSWORD,
    database: env.LEGACY_MYSQL_DATABASE,
  },

  storage: {
    driver: env.STORAGE_DRIVER,
    endpoint: env.STORAGE_ENDPOINT,
    region: env.STORAGE_REGION,
    accessKey: env.STORAGE_ACCESS_KEY,
    secretKey: env.STORAGE_SECRET_KEY,
    bucket: env.STORAGE_BUCKET,
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
    localRoot: env.STORAGE_LOCAL_ROOT,
    presignTtlSeconds: env.STORAGE_PRESIGN_TTL_SECONDS,
  },

  publicBaseUrl: env.PUBLIC_BASE_URL.replace(/\/+$/, ''),

  scheduler: {
    timezone: env.SCHEDULER_TZ,
    rolloverMonth: env.SCHEDULER_ROLLOVER_MONTH,
    rolloverDay: env.SCHEDULER_ROLLOVER_DAY,
    intervalMinutes: env.SCHEDULER_INTERVAL_MINUTES,
  },
} as const;

export type AppConfig = typeof config;
