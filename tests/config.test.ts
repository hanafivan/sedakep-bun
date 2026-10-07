import { describe, expect, it } from 'bun:test';

/**
 * Config dibaca sekali saat import, jadi perubahan skenario diuji lewat
 * subprocess supaya benar-benar menguji jalur boot yang berbeda.
 */

const cwd = new URL('..', import.meta.url).pathname;

const bootConfig = (env: Record<string, string>) =>
  Bun.spawnSync({
    cmd: ['bun', '-e', "await import('./api/config'); console.log('booted')"],
    cwd,
    env: {
      PATH: process.env.PATH ?? '',
      HOME: process.env.HOME ?? '',
      JWT_SECRET: 'secret',
      ...env,
    },
    stdout: 'pipe',
    stderr: 'pipe',
  });

describe('config', () => {
  it('development boleh pakai BASIC_AUTH_PASSWORD plaintext', () => {
    const result = bootConfig({
      NODE_ENV: 'development',
      BASIC_AUTH_PASSWORD: 'admin',
    });

    expect(result.stdout.toString()).toContain('booted');
  });

  it('produksi gagal boot tanpa BASIC_AUTH_PASSWORD_HASH', () => {
    const result = bootConfig({
      NODE_ENV: 'production',
      BASIC_AUTH_PASSWORD: 'admin',
      BASIC_AUTH_SALT: 'salt-produksi',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('BASIC_AUTH_PASSWORD_HASH');
  });

  it('produksi gagal boot kalau salt masih default', () => {
    const result = bootConfig({
      NODE_ENV: 'production',
      BASIC_AUTH_PASSWORD_HASH: 'aGFzaA==',
      BASIC_AUTH_SALT: 'dev-salt-ganti-di-produksi',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('BASIC_AUTH_SALT');
  });

  it('produksi boot kalau hash dan salt sudah diisi', () => {
    const result = bootConfig({
      NODE_ENV: 'production',
      BASIC_AUTH_PASSWORD_HASH: 'aGFzaA==',
      BASIC_AUTH_SALT: 'salt-produksi',
    });

    expect(result.stdout.toString()).toContain('booted');
  });

  it('gagal boot tanpa JWT_SECRET', () => {
    const result = Bun.spawnSync({
      cmd: ['bun', '-e', "await import('./api/config')"],
      cwd,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        JWT_SECRET: '',
      },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).not.toBe(0);
    expect(result.stderr.toString()).toContain('JWT_SECRET');
  });
});
