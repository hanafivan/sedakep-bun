import { describe, expect, it } from 'bun:test';
import { derivePasswordHash, verifyPasswordHash } from '../api/shared/password';

const ITERATIONS = 5_000; // kecil supaya test cepat

describe('password util', () => {
  it('password sama + salt berbeda menghasilkan hash berbeda', async () => {
    const a = await derivePasswordHash('rahasia', 'salt-satu', ITERATIONS);
    const b = await derivePasswordHash('rahasia', 'salt-dua', ITERATIONS);

    expect(a).not.toBe(b);
  });

  it('hash deterministik untuk salt dan iterasi yang sama', async () => {
    const a = await derivePasswordHash('rahasia', 'salt-sama', ITERATIONS);
    const b = await derivePasswordHash('rahasia', 'salt-sama', ITERATIONS);

    expect(a).toBe(b);
  });

  it('iterasi berbeda menghasilkan hash berbeda', async () => {
    const a = await derivePasswordHash('rahasia', 'salt-sama', ITERATIONS);
    const b = await derivePasswordHash('rahasia', 'salt-sama', ITERATIONS + 1);

    expect(a).not.toBe(b);
  });

  it('verifikasi cocok untuk password benar', async () => {
    const hash = await derivePasswordHash('rahasia', 'salt-sama', ITERATIONS);
    const valid = await verifyPasswordHash('rahasia', hash, 'salt-sama', ITERATIONS);

    expect(valid).toBe(true);
  });

  it('verifikasi gagal untuk password salah', async () => {
    const hash = await derivePasswordHash('rahasia', 'salt-sama', ITERATIONS);
    const valid = await verifyPasswordHash('salah', hash, 'salt-sama', ITERATIONS);

    expect(valid).toBe(false);
  });

  it('verifikasi gagal ketika salt diubah', async () => {
    const hash = await derivePasswordHash('rahasia', 'salt-satu', ITERATIONS);
    const valid = await verifyPasswordHash('rahasia', hash, 'salt-dua', ITERATIONS);

    expect(valid).toBe(false);
  });
});
