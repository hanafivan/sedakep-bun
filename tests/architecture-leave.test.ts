import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

/** Guard arsitektur modul cuti: SQL hanya di command/query, engine tetap pure. */

const read = (rel: string) =>
  readFileSync(new URL(`../api/modules/leave/${rel}`, import.meta.url), 'utf8');

// Case-sensitive: SQL ditulis HURUF BESAR; kata Indonesia dicampur huruf kecil.
const SQL_PATTERN = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/;

describe('batas modul cuti', () => {
  it('service tidak berisi SQL mentah', () => {
    expect(read('service/leave.service.ts')).not.toMatch(SQL_PATTERN);
    expect(read('service/quota.service.ts')).not.toMatch(SQL_PATTERN);
    expect(read('service/letter.service.ts')).not.toMatch(SQL_PATTERN);
    expect(read('service/admin.service.ts')).not.toMatch(SQL_PATTERN);
  });

  it('engine kuota dan aturan jenis cuti tidak menyentuh database', () => {
    for (const rel of ['domain/quota-engine.ts', 'domain/leave-types.ts']) {
      const source = read(rel);
      expect(source).not.toMatch(SQL_PATTERN);
      expect(source).not.toContain('getMySql');
      expect(source).not.toContain("from '../../../db");
    }
  });

  it('command hanya operasi tulis', () => {
    const command = read('command/leave.command.ts');
    // Penomoran surat memakai LAST_INSERT_ID(expr) di dalam INSERT ... ON
    // DUPLICATE KEY UPDATE; itu tetap operasi tulis, bukan pembacaan terpisah.
    expect(command).not.toMatch(/\bSELECT\b.+FROM\b/s);
    expect(command).toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });

  it('query hanya operasi baca', () => {
    const query = read('query/leave.query.ts');
    expect(query).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(query).toMatch(/\bSELECT\b/);
  });

  it('service mengakses data lewat command dan query', () => {
    const service = read('service/leave.service.ts');
    expect(service).toContain("from '../command'");
    expect(service).toContain("from '../query'");
  });
});
