import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

/** Guard arsitektur modul cuti: SQL hanya di command/query, engine tetap pure. */

const readRequest = (rel: string) =>
  readFileSync(new URL(`../api/modules/leave-requests/${rel}`, import.meta.url), 'utf8');

const readQuota = (rel: string) =>
  readFileSync(new URL(`../api/modules/leave-quota/${rel}`, import.meta.url), 'utf8');

const readLetter = (rel: string) =>
  readFileSync(new URL(`../api/modules/leave-letters/${rel}`, import.meta.url), 'utf8');

const readAdmin = (rel: string) =>
  readFileSync(new URL(`../api/modules/leave-admin/${rel}`, import.meta.url), 'utf8');

// Case-sensitive: SQL ditulis HURUF BESAR; kata Indonesia dicampur huruf kecil.
const SQL_PATTERN = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/;

describe('batas modul cuti', () => {
  it('domain tidak berisi SQL mentah', () => {
    expect(readRequest('domain/leave.domain.ts')).not.toMatch(SQL_PATTERN);
    expect(readRequest('domain/leave-approval.domain.ts')).not.toMatch(SQL_PATTERN);
    expect(readRequest('domain/leave-pdf.domain.ts')).not.toMatch(SQL_PATTERN);
    expect(readRequest('domain/leave-export.domain.ts')).not.toMatch(SQL_PATTERN);
    expect(readQuota('domain/quota.domain.ts')).not.toMatch(SQL_PATTERN);
    expect(readLetter('domain/letter.domain.ts')).not.toMatch(SQL_PATTERN);
    expect(readAdmin('domain/admin.domain.ts')).not.toMatch(SQL_PATTERN);
  });

  it('engine kuota dan aturan jenis cuti tidak menyentuh database', () => {
    expect(readQuota('domain/quota-engine.ts')).not.toMatch(SQL_PATTERN);
    expect(readQuota('domain/quota-engine.ts')).not.toContain('getMySql');
    expect(readQuota('domain/quota-engine.ts')).not.toContain("from '../../../db");

    expect(readRequest('domain/leave-types.ts')).not.toMatch(SQL_PATTERN);
    expect(readRequest('domain/leave-types.ts')).not.toContain('getMySql');
    expect(readRequest('domain/leave-types.ts')).not.toContain("from '../../../db");
  });

  it('command hanya operasi tulis', () => {
    const command = readRequest('command/leave.command.ts');
    // Penomoran surat memakai LAST_INSERT_ID(expr) di dalam INSERT ... ON
    // DUPLICATE KEY UPDATE; itu tetap operasi tulis, bukan pembacaan terpisah.
    expect(command).not.toMatch(/\bSELECT\b.+FROM\b/s);
    expect(command).toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });

  it('query hanya operasi baca', () => {
    const query = readRequest('query/leave.query.ts');
    expect(query).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(query).toMatch(/\bSELECT\b/);
  });

  it('domain mengakses data lewat command dan query', () => {
    const domain = readRequest('domain/leave.domain.ts');
    expect(domain).toContain("from '../command'");
    expect(domain).toContain("from '../query'");
  });
});
