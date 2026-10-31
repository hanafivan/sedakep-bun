/**
 * Set ulang kata sandi akun demo agar bisa dipakai menguji endpoint cuti.
 * Akun demo = data uji, bukan hasil migrasi (user migrasi tidak punya plaintext).
 * Hanya menyentuh tiga username yang disebut di bawah.
 */
import { mysqlExecute, mysqlQuery, closeMySql, type MysqlRow } from '../api/db/mysql';

const TARGETS = ['admin.sedakep', 'atasan.sedakep', 'pegawai.sedakep'];
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) {
  console.error('DEMO_PASSWORD wajib diisi (jangan hard-code di file).');
  process.exit(1);
}

const hash = await Bun.password.hash(PASSWORD, { algorithm: 'argon2id', memoryCost: 16, timeCost: 2 });

const rows = await mysqlQuery<(MysqlRow & { id: number; username: string })[]>(
  `SELECT id, username FROM users WHERE username IN ('admin.sedakep','atasan.sedakep','pegawai.sedakep')`,
);
for (const row of rows) {
  await mysqlExecute(
    `UPDATE users SET password_hash = ?, password_algo = 'argon2id', must_rehash = 0 WHERE id = ?`,
    [hash, row.id],
  );
  console.log(`reset ${row.username} (id ${row.id})`);
}
console.log(`${rows.length} akun diperbarui. Kata sandi tidak ditampilkan di sini.`);
console.log(`target: ${TARGETS.join(', ')}`);
await closeMySql();
