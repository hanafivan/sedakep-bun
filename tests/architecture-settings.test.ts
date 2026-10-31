import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

/** Guard arsitektur modul pengaturan: SQL hanya di command/query. */

const read = (rel: string) =>
  readFileSync(new URL(`../api/modules/settings/${rel}`, import.meta.url), 'utf8');

// Case-sensitive: SQL ditulis HURUF BESAR; kata Indonesia dicampur huruf kecil.
const SQL_PATTERN = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/;

describe('batas modul pengaturan', () => {
  it('service tidak berisi SQL mentah', () => {
    expect(read('service/index.ts')).not.toMatch(SQL_PATTERN);
  });

  it('service mengakses data lewat command dan query', () => {
    const service = read('service/index.ts');
    expect(service).toContain("from '../command'");
    expect(service).toContain("from '../query'");
  });

  it('command hanya berisi operasi tulis', () => {
    const command = read('command/index.ts');
    expect(command).not.toMatch(/\bSELECT\b.+FROM\b/s);
    expect(command).toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
  });

  it('query hanya berisi operasi baca', () => {
    const query = read('query/index.ts');
    expect(query).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(query).toMatch(/\bSELECT\b/);
  });
});
