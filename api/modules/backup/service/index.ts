import { readdir, stat } from 'node:fs/promises';
import type { RowDataPacket } from 'mysql2/promise';
import { config } from '../../../config';
import { mysqlQuery } from '../../../db/mysql';
import { badRequest, notFound } from '../../../shared/errors';

/**
 * Service backup/restore — operasi operasional database.
 *
 * - Backup memakai `mysqldump` (sama seperti `scripts/backup.ts`).
 * - Restore mengimpor berkas yang SUDAH ada di folder `backups/` (bukan unggahan
 *   bebas), dan wajib menyertakan konfirmasi bertuliskan "RESTORE".
 * - Nama berkas divalidasi ketat agar tidak bisa menunjuk keluar folder.
 */

const BACKUP_DIR = 'backups';
const MYSQLDUMP = process.env.MYSQLDUMP_BIN ?? 'mysqldump';
const MYSQL_BIN = process.env.MYSQL_BIN ?? 'mysql';
const FILENAME_PATTERN = /^db-[A-Za-z0-9._-]+\.sql$/;

const mysqlArgs = () => {
  const args = ['-h', config.mysql.host, '-P', String(config.mysql.port), '-u', config.mysql.user];
  if (config.mysql.password) args.push(`-p${config.mysql.password}`);
  return args;
};

export const listBackups = async () => {
  let names: string[] = [];
  try {
    names = await readdir(BACKUP_DIR);
  } catch {
    return [];
  }
  const files = await Promise.all(
    names
      .filter((name) => FILENAME_PATTERN.test(name))
      .map(async (name) => {
        const info = await stat(`${BACKUP_DIR}/${name}`);
        return {
          filename: name,
          size_bytes: info.size,
          created_at: info.mtime.toISOString(),
        };
      }),
  );
  return files.sort((a, b) => b.created_at.localeCompare(a.created_at));
};

export const createBackup = async () => {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(BACKUP_DIR, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `db-${stamp}.sql`;

  const proc = Bun.spawnSync(
    [MYSQLDUMP, ...mysqlArgs(), '--single-transaction', '--routines', '--databases', config.mysql.database],
    { stdout: 'pipe', stderr: 'pipe' },
  );
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr).trim();
    throw badRequest(`mysqldump gagal: ${stderr || `exit ${proc.exitCode}`}`);
  }

  await Bun.write(`${BACKUP_DIR}/${filename}`, proc.stdout);

  const rows = await mysqlQuery<Array<RowDataPacket & { c: number }>>(
    'SELECT COUNT(*) AS c FROM documents',
  );
  const info = await stat(`${BACKUP_DIR}/${filename}`);

  return {
    filename,
    size_bytes: info.size,
    documents: Number(rows[0]?.c ?? 0),
  };
};

export const restoreBackup = async (filename: string, confirm: string) => {
  if (confirm !== 'RESTORE') {
    throw badRequest('Ketik "RESTORE" untuk mengonfirmasi tindakan ini');
  }
  if (!FILENAME_PATTERN.test(filename)) {
    throw badRequest('Nama berkas backup tidak valid');
  }

  const available = await listBackups();
  if (!available.some((file) => file.filename === filename)) {
    throw notFound('Berkas backup tidak ditemukan');
  }

  const file = Bun.file(`${BACKUP_DIR}/${filename}`);
  const proc = Bun.spawnSync([MYSQL_BIN, ...mysqlArgs()], {
    stdin: file,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (proc.exitCode !== 0) {
    const stderr = new TextDecoder().decode(proc.stderr).trim();
    throw badRequest(`restore gagal: ${stderr || `exit ${proc.exitCode}`}`);
  }

  return { filename };
};
