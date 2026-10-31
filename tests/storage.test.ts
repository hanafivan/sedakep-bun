import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorage } from '../api/shared/storage';

/**
 * Kontrak adapter storage diuji lewat driver lokal, jadi test tetap jalan
 * tanpa MinIO. Perilaku MinioStorage identik karena memakai interface yang sama.
 */

let root: string;
let sourceDir: string;
let storage: LocalStorage;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'sedakep-storage-test-'));
  sourceDir = await mkdtemp(join(tmpdir(), 'sedakep-storage-src-'));
  storage = new LocalStorage(root);
});

afterAll(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(sourceDir, { recursive: true, force: true });
});

describe('LocalStorage', () => {
  it('menyimpan dan membaca kembali isi file dengan utuh', async () => {
    const key = 'legacy/leave/3367/file_sk/surat uji.pdf';
    const payload = Buffer.from('isi dokumen uji');

    const result = await storage.put({ body: payload, objectKey: key });
    expect(result.sizeBytes).toBe(payload.length);
    expect(result.bucket).toBe('local');

    const stream = await storage.get(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);
    expect(Buffer.concat(chunks).toString()).toBe('isi dokumen uji');
  });

  it('putFromFile memindahkan file tanpa merusak isinya', async () => {
    const source = join(sourceDir, 'dari-disk.pdf');
    await writeFile(source, 'kandungan dari disk');

    const key = 'legacy/pension/95/foto/dari-disk.pdf';
    const result = await storage.putFromFile(source, key, 'application/pdf');
    expect(result.sizeBytes).toBe(Buffer.byteLength('kandungan dari disk'));

    const head = await storage.head(key);
    expect(head?.contentType).toBe('application/pdf');
    expect(head?.sizeBytes).toBe(Buffer.byteLength('kandungan dari disk'));
  });

  it('head mengembalikan null untuk object yang tidak ada', async () => {
    expect(await storage.head('legacy/tidak-ada/dokumen.pdf')).toBeNull();
  });

  it('get mengembalikan null, bukan melempar error, untuk object yang tidak ada', async () => {
    expect(await storage.get('legacy/tidak-ada/dokumen.pdf')).toBeNull();
  });

  it('exists membedakan object ada dan tidak ada', async () => {
    const key = 'legacy/exists/cek.pdf';
    expect(await storage.exists(key)).toBe(false);
    await storage.put({ body: Buffer.from('x'), objectKey: key });
    expect(await storage.exists(key)).toBe(true);
  });

  it('remove menghapus object dan aman dipanggil dua kali', async () => {
    const key = 'legacy/remove/cek.pdf';
    await storage.put({ body: Buffer.from('x'), objectKey: key });
    await storage.remove(key);
    expect(await storage.exists(key)).toBe(false);
    await storage.remove(key); // tidak boleh melempar
  });

  it('menolak object key yang mencoba keluar dari root storage', async () => {
    await expect(
      storage.put({ body: Buffer.from('x'), objectKey: '../../etc/passwd' }),
    ).rejects.toThrow(/traversal/i);
  });

  it('menebak content-type berdasarkan ekstensi', async () => {
    const cases: Array<[string, string]> = [
      ['a.pdf', 'application/pdf'],
      ['a.jpg', 'image/jpeg'],
      ['a.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['a.bin', 'application/octet-stream'],
    ];
    for (const [name, expected] of cases) {
      const key = `legacy/type/${name}`;
      await storage.put({ body: Buffer.from('x'), objectKey: key });
      const head = await storage.head(key);
      expect(head?.contentType).toBe(expected);
    }
  });

  it('checksum isi object stabil setelah disimpan', async () => {
    const key = 'legacy/checksum/stabil.pdf';
    const payload = Buffer.from('checksum stabil 12345');
    const expected = createHash('sha256').update(payload).digest('hex');

    await storage.put({ body: payload, objectKey: key });
    const stream = await storage.get(key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream as AsyncIterable<Buffer>) chunks.push(chunk);

    expect(createHash('sha256').update(Buffer.concat(chunks)).digest('hex')).toBe(expected);
  });
});