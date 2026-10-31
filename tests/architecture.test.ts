import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';

/** Guard arsitektur: service tidak boleh menulis SQL sendiri. */
const read = (rel: string) =>
  readFileSync(new URL(`../api/modules/user/${rel}`, import.meta.url), 'utf8');

//  cocok setelah ':' atau '-', jadi pola ini sengaja case-sensitive:
// SQL ditulis HURUF BESAR, sedangkan kata Indonesia ('update', 'hapus') tidak.
const SQL_PATTERN = /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|PRAGMA)\b/;

describe('batas modul user', () => {
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
    expect(command).not.toMatch(/\bSELECT\b/);
    expect(command).toMatch(/\b(INSERT|UPDATE|DELETE)\b/i);
  });

  it('query hanya berisi operasi baca', () => {
    const query = read('query/index.ts');
    expect(query).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/);
    expect(query).toMatch(/\bSELECT\b/i);
  });
});
