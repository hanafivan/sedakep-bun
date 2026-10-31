/** Tipe internal modul dokumen. */

export type DocumentRow = {
  id: number;
  bucket: string;
  object_key: string;
  original_filename: string;
  mime_type: string | null;
  extension: string | null;
  size_bytes: number | null;
  sha256: string | null;
  checksum_verified: number;
  status: string;
  created_at: string;
};

export type DocumentLinkRow = {
  id: number;
  document_id: number;
  entity_table: string;
  entity_id: number;
  field: string;
  label: string | null;
};
