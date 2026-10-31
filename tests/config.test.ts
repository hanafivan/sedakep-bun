import { describe, expect, it } from 'bun:test';

/**
 * Config dibaca sekali saat import, jadi perubahan skenario diuji lewat
 * subprocess supaya benar-benar menguji jalur boot yang berbeda.
 */

const cwd = new URL('..', import.meta.url).pathname;

const PRODUCTION_SAFE = {
  NODE_ENV: 'production',
  JWT_SECRET: 'jwt-produksi-yang-aman',
  BASIC_AUTH_PASSWORD_HASH: 'aGFzaA==',
  BASIC_AUTH_SALT: 'salt-produksi',
  STORAGE_ACCESS_KEY: 'access-produksi',
  STORAGE_SECRET_KEY: 'secret-produksi',
};

const bootConfig = (env: Record<string, string>) =>
  Bun.spawnSync({
    cmd: [
      process.execPath,
      '-e',
      "Object.assign(process.env, JSON.parse(process.argv[1])); await import('./api/config'); console.log('booted')",
      JSON.stringify(env),
    ],
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });

describe('config', () => {
  it('development boleh pakai BASIC_AUTH_PASSWORD plaintext', () => {
    const result = bootConfig({
      NODE_ENV: 'development',
      JWT_SECRET: 'dev-secret',
      BASIC_AUTH_PASSWORD: 'admin',
    });

    expect(result.stdout.toString()).toContain('booted');
  });

  it('produksi gagal boot tanpa BASIC_AUTH_PASSWORD_HASH', () => {
    const result = bootConfig({
      ...PRODUCTION_SAFE,
      BASIC_AUTH_PASSWORD_HASH: undefined!,
      BASIC_AUTH_PASSWORD: 'admin',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('BASIC_AUTH_PASSWORD_HASH');
  });

  it('produksi gagal boot kalau salt masih default', () => {
    const result = bootConfig({
      ...PRODUCTION_SAFE,
      BASIC_AUTH_SALT: 'dev-salt-ganti-di-produksi',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('BASIC_AUTH_SALT');
  });

  it('produksi boot kalau semua secret sudah diisi', () => {
    const result = bootConfig(PRODUCTION_SAFE);

    expect(result.stdout.toString()).toContain('booted');
  });

  it('produksi gagal boot kalau JWT_SECRET masih default', () => {
    const result = bootConfig({
      ...PRODUCTION_SAFE,
      JWT_SECRET: 'dev-secret-ganti-di-produksi',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('JWT_SECRET');
  });

  it('produksi gagal boot kalau STORAGE_ACCESS_KEY masih default', () => {
    const result = bootConfig({
      ...PRODUCTION_SAFE,
      STORAGE_ACCESS_KEY: 'minioadmin',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('STORAGE_ACCESS_KEY');
  });

  it('gagal boot tanpa JWT_SECRET', () => {
    const result = Bun.spawnSync({
      cmd: [
        process.execPath,
        '-e',
        "delete process.env.JWT_SECRET; await import('./api/config')",
      ],
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('JWT_SECRET');
  });
});