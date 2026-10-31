/**
 * Verifikasi adapter storage (MinIO/S3) secara end-to-end.
 *
 * Jalankan:
 *   bun run storage:verify
 *
 * Membutuhkan MinIO aktif di STORAGE_ENDPOINT dan bucket sudah dibuat
 * (dibuat otomatis bila belum ada).
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../api/config';
import { createStorage } from '../api/shared/storage';
import { ensureBucket } from '../api/shared/storage-bucket';

const storage = createStorage();
const sha256 = (buf: Buffer | Uint8Array) => createHash('sha256').update(buf).digest('hex');

const streamToBuffer = async (stream: AsyncIterable<Uint8Array>): Promise<Buffer> => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
};

class VerificationError extends Error {}
const fail = (msg: string): never => {
  throw new VerificationError(msg);
};
const requireValue = <T>(value: T | null | undefined, message: string): NonNullable<T> => {
  if (value === null || value === undefined) fail(message);
  return value as NonNullable<T>;
};

const main = async () => {
  console.log('\n=== Verifikasi adapter storage ===');
  console.log(`driver   : ${config.storage.driver}`);
  console.log(`endpoint : ${config.storage.endpoint}`);
  console.log(`bucket   : ${config.storage.bucket}\n`);

  await ensureBucket(storage as never, config.storage.bucket);
  console.log('✓ bucket siap');

  const tmp = await mkdtemp(join(tmpdir(), 'sedakep-storage-'));
  const samplePath = join(tmp, 'contoh surat uji.pdf');
  const payload = Buffer.from(
    `%PDF-1.4\n% dokumen uji adapter sedakep\n${Date.now()}\n`,
    'utf8',
  );
  await writeFile(samplePath, payload);

  const key = 'legacy/verification/adapter-test/contoh surat uji.pdf';

  // 1. putFromFile (stream dari disk)
  const put = await storage.putFromFile(samplePath, key, 'application/pdf');
  if (put.sizeBytes !== payload.length) fail('ukuran hasil putFromFile tidak cocok');
  console.log(`✓ putFromFile (${put.sizeBytes} bytes, etag ${put.etag.slice(0, 14)}…)`);

  // 2. head
  const meta = requireValue(
    await storage.head(key),
    'head tidak menemukan object yang baru diunggah',
  );
  if (meta.sizeBytes !== payload.length) fail('ukuran pada head tidak cocok');
  if (meta.contentType !== 'application/pdf') fail(`content-type salah: ${meta.contentType}`);
  console.log(`✓ head (content-type ${meta.contentType})`);

  // 3. exists
  if (!(await storage.exists(key))) fail('exists mengembalikan false untuk object yang ada');
  if (await storage.exists('legacy/verification/tidak-ada.pdf')) fail('exists true untuk object palsu');
  console.log('✓ exists');

  // 4. get + checksum
  const stream = requireValue(
    await storage.get(key),
    'get tidak mengembalikan stream',
  );
  const downloaded = await streamToBuffer(stream);
  if (sha256(downloaded) !== sha256(payload)) fail('checksum hasil download berbeda dengan sumber');
  console.log(`✓ get + checksum sha256 cocok (${downloaded.length} bytes)`);

  // 5. get object yang tidak ada → null, bukan error
  if ((await storage.get('legacy/verification/tidak-ada.pdf')) !== null) {
    fail('get seharusnya null untuk object yang tidak ada');
  }
  console.log('✓ get object tidak ada mengembalikan null');

  // 6. presigned URL
  const presigned = await storage.presignGetObject(key);
  if (!presigned.url.startsWith('http')) fail(`presigned URL tidak valid: ${presigned.url}`);
  const res = await fetch(presigned.url);
  if (!res.ok) fail(`presigned URL tidak bisa diakses (status ${res.status})`);
  const viaUrl = Buffer.from(await res.arrayBuffer());
  if (sha256(viaUrl) !== sha256(payload)) fail('isi via presigned URL berbeda dari sumber');
  console.log('✓ presigned URL dapat diakses dan isinya cocok');

  // 7. delete
  await storage.remove(key);
  if (await storage.exists(key)) fail('object masih ada setelah remove');
  console.log('✓ remove');

  await rm(tmp, { recursive: true, force: true });
  console.log('\nSemua pemeriksaan adapter storage lulus.\n');
};

try {
  await main();
} catch (error) {
  if (error instanceof VerificationError) {
    console.error(`\n  GAGAL: ${error.message}\n`);
    process.exit(1);
  }
  throw error;
}
