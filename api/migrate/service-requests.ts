import { getMySql, type MysqlRow } from '../db/mysql';
import { getLegacyMySql } from '../db/legacy-mysql';
import {
  alreadyMigrated,
  recordItem,
  rememberMapping,
} from './legacy-map';

export type ServiceRequestsMigrationCounters = {
  read: number;
  inserted: number;
  skipped: number;
  unmappedUser: number;
  byType: Record<string, number>;
};

interface ServiceConfig {
  legacyTable: string;
  legacyPk: string;
  serviceType: string;
  accTable?: string;
  accFk?: string;
  fieldKeys?: string[];
  titleColumn?: string;
  campusColumn?: string;
  facultyColumn?: string;
  majorColumn?: string;
  subtypeColumn?: string;
  approverFields?: {
    name?: string;
    nip?: string;
    position?: string;
  };
}

const SERVICE_CONFIGS: ServiceConfig[] = [
  {
    legacyTable: 'hlm_bpjs',
    legacyPk: 'id_bpjs',
    serviceType: 'bpjs',
    accTable: 'hlm_bpjs_acc',
    accFk: 'id_bpjs',
  },
  {
    legacyTable: 'hlm_gelar',
    legacyPk: 'id_gelar',
    serviceType: 'gelar',
    accTable: 'hlm_gelar_acc',
    accFk: 'id_gelar',
  },
  {
    legacyTable: 'hlm_ibel',
    legacyPk: 'id_ibel',
    serviceType: 'ibel',
    accTable: 'hlm_ibel_acc',
    accFk: 'id_ibel',
    campusColumn: 'kampus',
    facultyColumn: 'fac',
    majorColumn: 'jur',
  },
  {
    legacyTable: 'hlm_karisu',
    legacyPk: 'id_karisu',
    serviceType: 'karisu',
    accTable: 'hlm_karisu_acc',
    accFk: 'id_karisu',
  },
  {
    legacyTable: 'hlm_karpeg',
    legacyPk: 'id_karpeg',
    serviceType: 'karpeg',
    accTable: 'hlm_karpeg_acc',
    accFk: 'id_karpeg',
  },
  {
    legacyTable: 'hlm_pangkat',
    legacyPk: 'id_pangkat',
    serviceType: 'pangkat',
    accTable: 'hlm_pangkat_sk',
    accFk: 'id_pangkat',
    titleColumn: 'pangkat',
  },
  {
    legacyTable: 'hlm_pens_reg_usul',
    legacyPk: 'id_penreg',
    serviceType: 'pensiun',
    accTable: 'hlm_pens_reg_acc',
    accFk: 'id_penreg',
    titleColumn: 'pensiun',
    fieldKeys: ['tempat_lahir', 'tgl_lahir', 'alamat', 'alamat_pensiun', 'pensiun'],
  },
  {
    legacyTable: 'hlm_satlen',
    legacyPk: 'id_satlen',
    serviceType: 'satlen',
    accTable: 'hlm_satlen_acc',
    accFk: 'id_satlen',
    titleColumn: 'satlen',
    approverFields: {
      name: 'atasan',
      nip: 'nip_atasan',
      position: 'jab_atasan',
    },
  },
  {
    legacyTable: 'hlm_taspen',
    legacyPk: 'id_taspen',
    serviceType: 'taspen',
    accTable: 'hlm_taspen_acc',
    accFk: 'id_taspen',
  },
  {
    legacyTable: 'tbl_pmk',
    legacyPk: 'id_pmk',
    serviceType: 'pmk',
    accTable: 'tbl_pmk_acc',
    accFk: 'id_pmk',
  },
  {
    legacyTable: 'tbl_skmi_skpp',
    legacyPk: 'id_skmi_skpp',
    serviceType: 'skmi_skpp',
    accTable: 'tbl_skmi_skpp_acc',
    accFk: 'id_skmi_skpp',
    subtypeColumn: 'tipe',
  },
  {
    legacyTable: 'tugas_belajar',
    legacyPk: 'id_tb',
    serviceType: 'tugas_belajar',
    accTable: 'tugas_belajar_acc',
    accFk: 'id_tb',
    campusColumn: 'kampus',
    facultyColumn: 'fac',
    majorColumn: 'jur',
    subtypeColumn: 'jenis_tb',
  },
];

const mapDecisionAndStatus = (accValue: unknown): {
  status: 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
  decision: 'pending' | 'accepted' | 'rejected' | 'cancelled';
} => {
  const v = String(accValue ?? '').trim().toLowerCase();
  if (v === 'diterima' || v === '1' || v === 'setuju') {
    return { status: 'approved', decision: 'accepted' };
  }
  if (v === 'ditolak' || v === '2' || v === 'tolak') {
    return { status: 'rejected', decision: 'rejected' };
  }
  if (v === 'belum lengkap' || v === 'revisi' || v === '3') {
    return { status: 'in_review', decision: 'pending' };
  }
  return { status: 'submitted', decision: 'pending' };
};

export const migrateServiceRequests = async (options: {
  dryRun?: boolean;
  batchLimit?: number;
  onProgress?: (done: number, total: number, table: string) => void;
} = {}): Promise<ServiceRequestsMigrationCounters> => {
  const dryRun = options.dryRun ?? false;
  const legacy = getLegacyMySql();
  const app = getMySql();

  const counters: ServiceRequestsMigrationCounters = {
    read: 0,
    inserted: 0,
    skipped: 0,
    unmappedUser: 0,
    byType: {},
  };

  // Map user legacy -> target
  const [userRows] = await app.query<MysqlRow[]>(
    `SELECT legacy_pk, target_id FROM legacy_mappings WHERE legacy_table = 'tbl_user' AND target_table = 'users'`,
  );
  const userMap = new Map<number, number>();
  for (const row of userRows as unknown as Array<{ legacy_pk: string; target_id: number }>) {
    userMap.set(Number(row.legacy_pk), Number(row.target_id));
  }

  const [firstAdmin] = await app.query<MysqlRow[]>(
    "SELECT id FROM users WHERE role = 'admin' ORDER BY id ASC LIMIT 1",
  );
  const fallbackUserId = Number((firstAdmin[0] as { id?: number } | undefined)?.id ?? 1);

  for (const cfg of SERVICE_CONFIGS) {
    counters.byType[cfg.serviceType] = 0;

    // Check if table exists in legacy DB
    try {
      const [tableCheck] = await legacy.query<MysqlRow[]>(
        `SHOW TABLES LIKE '${cfg.legacyTable}'`,
      );
      if ((tableCheck as unknown[]).length === 0) {
        continue;
      }
    } catch {
      continue;
    }

    // Preload acc table if defined
    const accByFk = new Map<number, Record<string, unknown>>();
    if (cfg.accTable && cfg.accFk) {
      try {
        const [accCheck] = await legacy.query<MysqlRow[]>(
          `SHOW TABLES LIKE '${cfg.accTable}'`,
        );
        if ((accCheck as unknown[]).length > 0) {
          const [accRows] = await legacy.query<MysqlRow[]>(`SELECT * FROM ${cfg.accTable}`);
          for (const raw of accRows as unknown as Array<Record<string, unknown>>) {
            const fkVal = Number(raw[cfg.accFk]);
            if (fkVal) {
              accByFk.set(fkVal, raw);
            }
          }
        }
      } catch {
        // Table may not exist or be empty
      }
    }

    // Count rows
    const [totalRows] = await legacy.query<MysqlRow[]>(
      `SELECT COUNT(*) AS total FROM ${cfg.legacyTable}`,
    );
    const total = Number((totalRows[0] as { total: number }).total);
    if (total === 0) continue;

    const pageSize = 500;
    let offset = 0;

    while (offset < total) {
      const [rows] = await legacy.query<MysqlRow[]>(
        `SELECT * FROM ${cfg.legacyTable} ORDER BY ${cfg.legacyPk} ASC LIMIT ? OFFSET ?`,
        [pageSize, offset],
      );

      for (const raw of rows as unknown as Array<Record<string, unknown>>) {
        counters.read++;
        const legacyId = String(raw[cfg.legacyPk]);

        if (!dryRun && (await alreadyMigrated(cfg.legacyTable, legacyId))) {
          counters.skipped++;
          continue;
        }

        const legacyUserId = Number(raw.id_user);
        let targetUserId = userMap.get(legacyUserId);
        if (!targetUserId) {
          targetUserId = fallbackUserId;
          counters.unmappedUser++;
        }

        const accRow = accByFk.get(Number(legacyId));
        const accValue = accRow ? accRow.acc : null;
        const note = accRow ? (accRow.catatan ? String(accRow.catatan) : null) : null;
        const { status, decision } = mapDecisionAndStatus(accValue);

        const name = String(raw.nama || 'Tanpa Nama').trim();
        const nip = raw.nip ? String(raw.nip).trim().slice(0, 18) : null;
        const grade = raw.gol ? String(raw.gol).trim().slice(0, 20) : null;
        const position = raw.jabatan ? String(raw.jabatan).trim().slice(0, 150) : null;
        const orgName = raw.unit_kerja ? String(raw.unit_kerja).trim().slice(0, 150) : null;
        const phone = raw.telepon ? String(raw.telepon).trim().slice(0, 30) : null;

        const title = cfg.titleColumn && raw[cfg.titleColumn]
          ? String(raw[cfg.titleColumn]).trim().slice(0, 255)
          : null;
        const campus = cfg.campusColumn && raw[cfg.campusColumn]
          ? String(raw[cfg.campusColumn]).trim().slice(0, 200)
          : null;
        const faculty = cfg.facultyColumn && raw[cfg.facultyColumn]
          ? String(raw[cfg.facultyColumn]).trim().slice(0, 200)
          : null;
        const major = cfg.majorColumn && raw[cfg.majorColumn]
          ? String(raw[cfg.majorColumn]).trim().slice(0, 200)
          : null;
        const subtype = cfg.subtypeColumn && raw[cfg.subtypeColumn]
          ? String(raw[cfg.subtypeColumn]).trim().slice(0, 50)
          : null;

        const approver1Name = cfg.approverFields?.name && raw[cfg.approverFields.name]
          ? String(raw[cfg.approverFields.name]).trim().slice(0, 150)
          : null;
        const approver1Nip = cfg.approverFields?.nip && raw[cfg.approverFields.nip]
          ? String(raw[cfg.approverFields.nip]).trim().slice(0, 18)
          : null;
        const approver1Pos = cfg.approverFields?.position && raw[cfg.approverFields.position]
          ? String(raw[cfg.approverFields.position]).trim().slice(0, 150)
          : null;

        const createdAt = raw.tgl_dibuat ? new Date(String(raw.tgl_dibuat)) : new Date();
        const safeCreatedAt = isNaN(createdAt.getTime()) ? new Date() : createdAt;

        if (dryRun) {
          counters.inserted++;
          counters.byType[cfg.serviceType] = (counters.byType[cfg.serviceType] ?? 0) + 1;
          continue;
        }

        try {
          const [insertRes] = await app.query(
            `INSERT INTO service_requests (
               legacy_table, legacy_id, service_type, user_id, name, nip, grade,
               position, organization_name, phone, title, campus, faculty, major, subtype,
               approver_1_name, approver_1_nip, approver_1_position,
               status, decision, approver_1_status, decision_note, created_at, updated_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
            [
              cfg.legacyTable,
              legacyId,
              cfg.serviceType,
              targetUserId,
              name,
              nip,
              grade,
              position,
              orgName,
              phone,
              title,
              campus,
              faculty,
              major,
              subtype,
              approver1Name,
              approver1Nip,
              approver1Pos,
              status,
              decision,
              decision,
              note,
              safeCreatedAt,
              safeCreatedAt,
            ],
          );

          const newId = Number((insertRes as unknown as { insertId: number }).insertId);

          // Extra fields
          if (cfg.fieldKeys && cfg.fieldKeys.length > 0) {
            for (const fk of cfg.fieldKeys) {
              const val = raw[fk];
              if (val !== undefined && val !== null && String(val).trim() !== '') {
                await app.query(
                  `INSERT INTO service_request_fields (request_id, field_key, field_value)
                   VALUES (?, ?, ?)
                   ON DUPLICATE KEY UPDATE field_value = VALUES(field_value)`,
                  [newId, fk, String(val).trim()],
                );
              }
            }
          }

          await rememberMapping(cfg.legacyTable, legacyId, 'service_requests', newId);
          await recordItem({
            kind: 'row',
            sourceTable: cfg.legacyTable,
            sourceRecordId: legacyId,
            status: 'verified',
          });

          counters.inserted++;
          counters.byType[cfg.serviceType] = (counters.byType[cfg.serviceType] ?? 0) + 1;
        } catch (err) {
          await recordItem({
            kind: 'row',
            sourceTable: cfg.legacyTable,
            sourceRecordId: legacyId,
            status: 'failed',
            lastError: (err as Error).message,
          });
        }
      }

      offset += pageSize;
      if (options.onProgress) {
        options.onProgress(Math.min(offset, total), total, cfg.legacyTable);
      }
      if (options.batchLimit && counters.inserted >= options.batchLimit) {
        break;
      }
    }
  }

  return counters;
};
