import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import { detectAlgo } from '../shared/password-hash';
import { rememberMapping } from './legacy-map';

/**
 * Migrasi master: tbl_instansi/tbl_dept/tbl_jabatan/tbl_user → organizations,
 * positions, users.
 *
 * Password legacy adalah MD5 32 hex. Nilainya dipindahkan APA ADANYA dengan
 * `password_algo='md5'` dan `must_rehash=1`, sehingga user lama tetap bisa
 * login dan hash-nya otomatis di-upgrade ke Argon2id pada login pertama.
 * (MD5 tidak pernah dihitung ulang di sini — bukan untuk dipecahkan.)
 */

const slug = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

/** Kolom `admin` di legacy bukan boolean: 1=admin, >1=pegawai biasa. */
const roleOf = (adminFlag: number): 'admin' | 'pegawai' => (adminFlag === 1 ? 'admin' : 'pegawai');

export type UserMigrationCounters = {
  organizations: number;
  positions: number;
  users: number;
  skippedUsers: number;
};

export const migrateUsers = async (dryRun = false): Promise<UserMigrationCounters> => {
  const legacy = getLegacyMySql();
  const app = getMySql();
  const counters: UserMigrationCounters = {
    organizations: 0,
    positions: 0,
    users: 0,
    skippedUsers: 0,
  };

  // ---------- instansi → organizations ----------
  const [instansiRows] = await legacy.query<MysqlRow[]>('SELECT * FROM tbl_instansi');
  const orgIdByInstansi = new Map<number, number>();

  for (const raw of instansiRows as unknown as Array<Record<string, unknown>>) {
    const legacyId = String(raw.id_instansi);
    const name = String(raw.nama || raw.institusi || `Instansi ${legacyId}`);
    if (dryRun) {
      counters.organizations += 1;
      continue;
    }
    const [existing] = await app.query<MysqlRow[]>(
      'SELECT id FROM organizations WHERE legacy_id = ? LIMIT 1',
      [legacyId],
    );
    let orgId = Number((existing[0] as { id?: number } | undefined)?.id ?? 0);
    if (!orgId) {
      const [insert] = await app.query<MysqlRow[]>(
        'INSERT INTO organizations (legacy_id, code, name, level) VALUES (?,?,?,1)',
        [legacyId, `instansi-${legacyId}`, name],
      );
      orgId = Number((insert as unknown as { insertId: number }).insertId);
    }
    orgIdByInstansi.set(Number(raw.id_instansi), orgId);
    counters.organizations += 1;
  }

  // Unit kerja yang muncul di tbl_user tapi tidak ada di tbl_instansi.
  const [unitRows] = await legacy.query<MysqlRow[]>(
    'SELECT DISTINCT unit_kerja FROM tbl_user WHERE unit_kerja <> ""',
  );
  const orgIdByUnit = new Map<string, number>();
  for (const raw of unitRows as unknown as { unit_kerja: string }[]) {
    const unitName = String(raw.unit_kerja);
    const legacyKey = `unit:${unitName}`;
    if (dryRun) continue;
    const [existing] = await app.query<MysqlRow[]>(
      'SELECT id FROM organizations WHERE legacy_id = ? LIMIT 1',
      [legacyKey],
    );
    let orgId = Number((existing[0] as { id?: number } | undefined)?.id ?? 0);
    if (!orgId) {
      const [insert] = await app.query<MysqlRow[]>(
        'INSERT INTO organizations (legacy_id, code, name, level) VALUES (?,?,?,2)',
        [legacyKey, `unit-${slug(unitName)}`, unitName],
      );
      orgId = Number((insert as unknown as { insertId: number }).insertId);
      counters.organizations += 1;
    }
    orgIdByUnit.set(unitName, orgId);
  }

  // ---------- tbl_jabatan → positions ----------
  const [jabatanRows] = await legacy.query<MysqlRow[]>('SELECT * FROM tbl_jabatan');
  const positionIdByJabatan = new Map<number, number>();
  for (const raw of jabatanRows as unknown as Array<Record<string, unknown>>) {
    const name = String(raw.nama_jabatan ?? '').trim();
    if (!name) continue;
    counters.positions += 1;
    if (dryRun) continue;
    const [existing] = await app.query<MysqlRow[]>(
      'SELECT id FROM positions WHERE name = ? LIMIT 1',
      [name],
    );
    let positionId = Number((existing[0] as { id?: number } | undefined)?.id ?? 0);
    if (!positionId) {
      const [insert] = await app.query<MysqlRow[]>(
        'INSERT INTO positions (legacy_id, name) VALUES (?,?)',
        [String(raw.jabatan_id), name],
      );
      positionId = Number((insert as unknown as { insertId: number }).insertId);
    }
    positionIdByJabatan.set(Number(raw.jabatan_id), positionId);
  }

  // Jabatan yang dipakai user tapi tidak ada di tbl_jabatan.
  const [jabatanUserRows] = await legacy.query<MysqlRow[]>(
    'SELECT DISTINCT jabatan FROM tbl_user WHERE jabatan <> ""',
  );
  const positionIdByName = new Map<string, number>();
  for (const raw of jabatanUserRows as unknown as { jabatan: string }[]) {
    const name = String(raw.jabatan).trim();
    if (dryRun) continue;
    const [existing] = await app.query<MysqlRow[]>(
      'SELECT id FROM positions WHERE name = ? LIMIT 1',
      [name],
    );
    let positionId = Number((existing[0] as { id?: number } | undefined)?.id ?? 0);
    if (!positionId) {
      const [insert] = await app.query<MysqlRow[]>(
        'INSERT INTO positions (name) VALUES (?)',
        [name],
      );
      positionId = Number((insert as unknown as { insertId: number }).insertId);
      counters.positions += 1;
    }
    positionIdByName.set(name, positionId);
  }

  // ---------- tbl_user → users ----------
  const [userRows] = await legacy.query<MysqlRow[]>('SELECT * FROM tbl_user ORDER BY id_user');
  for (const raw of userRows as unknown as Array<Record<string, unknown>>) {
    const legacyId = String(raw.id_user);
    if (dryRun) {
      counters.users += 1;
      continue;
    }
    const [existing] = await app.query<MysqlRow[]>(
      'SELECT id FROM users WHERE legacy_id = ? LIMIT 1',
      [legacyId],
    );
    if (existing.length > 0) {
      counters.skippedUsers += 1;
      continue;
    }

    const adminFlag = Number(raw.admin ?? 2);
    const role = roleOf(adminFlag);
    const unitName = String(raw.unit_kerja ?? '').trim();
    const jobName = String(raw.jabatan ?? '').trim();
    const keaktifan = String(raw.keaktifan ?? '').trim();
    const isActive = keaktifan === 'Non Aktif' ? 0 : 1;
    const storedPassword = String(raw.password ?? '');
    const algo = detectAlgo(storedPassword);
    const nip = String(raw.nip ?? '').trim();

    const [insert] = await app.query<MysqlRow[]>(
      `INSERT INTO users (
         legacy_id, username, password_hash, password_algo, must_rehash,
         name, nip, grade, position_id, organization_id, unit_name,
         role, is_admin, is_active, employment_type
       ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        legacyId,
        String(raw.username),
        storedPassword,
        algo,
        algo === 'md5' ? 1 : 0,
        String(raw.nama ?? raw.username),
        nip || null,
        String(raw.golongan ?? '').trim() || null,
        positionIdByName.get(jobName) ?? null,
        orgIdByUnit.get(unitName) ?? orgIdByInstansi.get(1) ?? null,
        unitName || null,
        role,
        role === 'admin' ? 1 : 0,
        isActive,
        'pns',
      ],
    );
    const userId = Number((insert as unknown as { insertId: number }).insertId);
    await rememberMapping('tbl_user', legacyId, 'users', userId);
    counters.users += 1;
  }

  // ---------- tbl_admin → users (akun admin terpisah) ----------
  const [adminRows] = await legacy.query<MysqlRow[]>('SELECT * FROM tbl_admin');
  for (const raw of adminRows as unknown as Array<Record<string, unknown>>) {
    const legacyKey = `admin:${raw.id_admin}`;
    if (dryRun) continue;
    const [existing] = await app.query<MysqlRow[]>(
      'SELECT id FROM users WHERE legacy_id = ? LIMIT 1',
      [legacyKey],
    );
    if (existing.length > 0) continue;
    const storedPassword = String(raw.password ?? '');
    const [insert] = await app.query<MysqlRow[]>(
      `INSERT INTO users (
         legacy_id, username, password_hash, password_algo, must_rehash,
         name, nip, role, is_admin, is_active, employment_type
       ) VALUES (?,?,?,?,?,?,?,'admin',1,1,'pns')`,
      [
        legacyKey,
        String(raw.username),
        storedPassword,
        detectAlgo(storedPassword),
        1,
        String(raw.nama ?? raw.username),
        String(raw.nip ?? '') || null,
      ],
    );
    await rememberMapping('tbl_admin', String(raw.id_admin), 'users', Number((insert as unknown as { insertId: number }).insertId));
  }

  return counters;
};
