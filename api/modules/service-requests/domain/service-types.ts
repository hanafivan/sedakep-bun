/**
 * Konfigurasi per jenis layanan kepegawaian — PURE, tanpa akses database.
 *
 * Satu tabel `service_requests` melayani banyak jenis (semua modul layanan
 * legacy: gelar, karpeg, karis/karsu, BPJS, taspen, satya lencana, izin belajar,
 * tugas belajar, PMK, SKMI/SKPP, pangkat, pensiun). Nilai spesifik tiap jenis
 * disimpan di `service_request_fields`; di sini hanya label dan bentuknya.
 */

export const SERVICE_TYPE_VALUES = [
  'gelar',
  'karpeg',
  'karisu',
  'bpjs',
  'taspen',
  'satlen',
  'ibel',
  'tugas_belajar',
  'pmk',
  'skmi_skpp',
  'pangkat',
  'pensiun',
  'satya_lencana',
] as const;

export type ServiceType = (typeof SERVICE_TYPE_VALUES)[number];

export type ServiceFieldKind = 'text' | 'date' | 'textarea';
export type ServiceFieldDef = { key: string; label: string; kind: ServiceFieldKind };
export type ServiceDocDef = { label: string; title: string };
export type ServiceLetterType = 'sphd' | 'sppid' | 'sk' | 'suket';

export type ServiceTypeDef = {
  type: ServiceType;
  label: string;
  /** Label untuk kolom `subtype` (kosong = tak dipakai). */
  subtypeLabel?: string;
  subtypeOptions?: string[];
  fields: ServiceFieldDef[];
  documents: ServiceDocDef[];
  letters: ServiceLetterType[];
};

const T: ServiceFieldKind = 'text';

export const SERVICE_TYPES: Record<ServiceType, ServiceTypeDef> = {
  pensiun: {
    type: 'pensiun',
    label: 'Pensiun',
    fields: [
      { key: 'tempat_lahir', label: 'Tempat lahir', kind: T },
      { key: 'tgl_lahir', label: 'Tanggal lahir', kind: 'date' },
      { key: 'telepon', label: 'Telepon', kind: T },
      { key: 'pensiun', label: 'Jenis pensiun', kind: T },
      { key: 'alamat', label: 'Alamat', kind: 'textarea' },
      { key: 'alamat_pensiun', label: 'Alamat setelah pensiun', kind: 'textarea' },
    ],
    documents: [
      { label: 'foto', title: 'Foto' },
      { label: 'permohonan', title: 'Surat permohonan' },
      { label: 'cpns', title: 'SK CPNS' },
      { label: 'pns', title: 'SK PNS' },
      { label: 'kp_terakhir', title: 'SK Kenaikan Pangkat terakhir' },
      { label: 'skp', title: 'SKP' },
      { label: 'keluarga', title: 'Kartu Keluarga' },
      { label: 'buku_nikah', title: 'Buku Nikah' },
      { label: 'akta_anak', title: 'Akta Anak' },
      { label: 'drh', title: 'DRH' },
      { label: 'terakhir', title: 'SK Terakhir' },
      { label: 'jandud', title: 'Surat Janda/Duda' },
      { label: 'sakit', title: 'Surat Keterangan Sakit' },
      { label: 'dini', title: 'Surat Permohonan Pensiun Dini' },
      { label: 'ktp', title: 'KTP' },
      { label: 'kk', title: 'KK' },
    ],
    letters: ['sphd', 'sppid'],
  },
  gelar: {
    type: 'gelar',
    label: 'Gelar',
    fields: [
      { key: 'gelar', label: 'Gelar', kind: T },
      { key: 'jenjang', label: 'Jenjang', kind: T },
      { key: 'universitas', label: 'Universitas', kind: T },
      { key: 'tahun', label: 'Tahun lulus', kind: T },
    ],
    documents: [
      { label: 'ijazah', title: 'Ijazah' },
      { label: 'transkrip', title: 'Transkrip' },
      { label: 'sk', title: 'SK Tugas Belajar' },
    ],
    letters: ['sk'],
  },
  karpeg: {
    type: 'karpeg',
    label: 'Karpeg',
    fields: [],
    documents: [
      { label: 'cpns', title: 'SK CPNS' },
      { label: 'karpeg', title: 'Karpeg' },
      { label: 'pns', title: 'SK PNS' },
      { label: 'sttpl', title: 'STTPL' },
      { label: 'sumpah', title: 'Berita Acara Sumpah' },
    ],
    letters: [],
  },
  karisu: {
    type: 'karisu',
    label: 'Karis/Karsu',
    fields: [
      { key: 'nama_pasangan', label: 'Nama pasangan', kind: T },
      { key: 'jumlah_anak', label: 'Jumlah anak', kind: T },
    ],
    documents: [
      { label: 'keluarga', title: 'Kartu Keluarga' },
      { label: 'nikah', title: 'Buku Nikah' },
      { label: 'kp', title: 'SK Kenaikan Pangkat' },
      { label: 'karisu', title: 'Karis/Karsu' },
      { label: 'pns', title: 'SK PNS' },
      { label: 'cpns', title: 'SK CPNS' },
    ],
    letters: [],
  },
  bpjs: {
    type: 'bpjs',
    label: 'BPJS',
    fields: [{ key: 'no_bpjs', label: 'Nomor BPJS', kind: T }],
    documents: [
      { label: 'akta', title: 'Akta Lahir' },
      { label: 'bpjs', title: 'Kartu BPJS' },
      { label: 'cpns', title: 'SK CPNS' },
      { label: 'gaji', title: 'SK Gaji Berkala' },
      { label: 'kk', title: 'Kartu Keluarga' },
      { label: 'kp', title: 'SK Kenaikan Pangkat' },
      { label: 'pns', title: 'SK PNS' },
    ],
    letters: [],
  },
  taspen: {
    type: 'taspen',
    label: 'Taspen',
    fields: [{ key: 'no_taspen', label: 'Nomor Taspen', kind: T }],
    documents: [
      { label: 'karpeg', title: 'Karpeg' },
      { label: 'kgb', title: 'SK KGB' },
      { label: 'kp', title: 'SK Kenaikan Pangkat' },
      { label: 'pns', title: 'SK PNS' },
      { label: 'spmt', title: 'SPMT' },
      { label: 'taspen', title: 'Kartu Taspen' },
      { label: 'cpns', title: 'SK CPNS' },
    ],
    letters: [],
  },
  satlen: {
    type: 'satlen',
    label: 'Satya Lencana',
    fields: [
      { key: 'tahun', label: 'Tahun pengusulan', kind: T },
      { key: 'piagam', label: 'Nomor piagam', kind: T },
    ],
    documents: [
      { label: 'cpns', title: 'SK CPNS' },
      { label: 'drh', title: 'DRH' },
      { label: 'jabatan', title: 'SK Jabatan' },
      { label: 'kp', title: 'SK Kenaikan Pangkat' },
      { label: 'skp', title: 'SKP' },
    ],
    letters: ['sphd'],
  },
  satya_lencana: {
    type: 'satya_lencana',
    label: 'Satya Lencana',
    fields: [{ key: 'tahun', label: 'Tahun pengusulan', kind: T }],
    documents: [
      { label: 'cpns', title: 'SK CPNS' },
      { label: 'drh', title: 'DRH' },
      { label: 'skp', title: 'SKP' },
    ],
    letters: ['sphd'],
  },
  ibel: {
    type: 'ibel',
    label: 'Izin Belajar',
    fields: [
      { key: 'jenjang', label: 'Jenjang', kind: T },
      { key: 'universitas', label: 'Universitas', kind: T },
      { key: 'jurusan', label: 'Jurusan', kind: T },
      { key: 'tahun', label: 'Tahun', kind: T },
    ],
    documents: [
      { label: 'sk', title: 'SK Izin Belajar' },
      { label: 'sphd', title: 'SPHD' },
      { label: 'permohonan', title: 'Surat Permohonan' },
    ],
    letters: ['sphd'],
  },
  tugas_belajar: {
    type: 'tugas_belajar',
    label: 'Tugas Belajar',
    fields: [
      { key: 'jenjang', label: 'Jenjang', kind: T },
      { key: 'universitas', label: 'Universitas', kind: T },
      { key: 'jurusan', label: 'Jurusan', kind: T },
    ],
    documents: [
      { label: 'sk', title: 'SK Tugas Belajar' },
      { label: 'permohonan', title: 'Surat Permohonan' },
    ],
    letters: ['sk'],
  },
  pmk: {
    type: 'pmk',
    label: 'PMK',
    fields: [
      { key: 'jenjang', label: 'Jenjang', kind: T },
      { key: 'universitas', label: 'Universitas', kind: T },
    ],
    documents: [{ label: 'permohonan', title: 'Surat Permohonan' }],
    letters: ['sk'],
  },
  skmi_skpp: {
    type: 'skmi_skpp',
    label: 'SKMI/SKPP',
    fields: [{ key: 'keterangan', label: 'Keterangan', kind: 'textarea' }],
    documents: [{ label: 'permohonan', title: 'Surat Permohonan' }],
    letters: ['sk'],
  },
  pangkat: {
    type: 'pangkat',
    label: 'Kenaikan Pangkat',
    subtypeLabel: 'Jalur',
    subtypeOptions: ['jft', 'jfu', 'strk'],
    fields: [
      { key: 'periode', label: 'Periode', kind: T },
      { key: 'golongan', label: 'Golongan diusulkan', kind: T },
    ],
    documents: [
      { label: 'sk', title: 'SK Kenaikan Pangkat' },
      { label: 'kp', title: 'SK Pangkat Terakhir' },
      { label: 'kgb', title: 'SK KGB' },
      { label: 'skp', title: 'SKP' },
    ],
    letters: ['sk'],
  },
};

export const knownServiceTypes = (): ServiceType[] => [...SERVICE_TYPE_VALUES];

export const isServiceType = (value: string): value is ServiceType =>
  (SERVICE_TYPE_VALUES as readonly string[]).includes(value);

export const getServiceTypeDef = (type: string): ServiceTypeDef | null =>
  isServiceType(type) ? SERVICE_TYPES[type] : null;

/** Label berkas yang sah untuk satu jenis layanan. */
export const documentLabelsFor = (type: string): string[] =>
  getServiceTypeDef(type)?.documents.map((doc) => doc.label) ?? [];
