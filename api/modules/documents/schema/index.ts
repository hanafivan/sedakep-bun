import { z } from '@hono/zod-openapi';

/** Validator & Schema modul dokumen. */

export const DocumentSchema = z.object({
  id: z.number(),
  original_filename: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number().nullable(),
  status: z.string(),
  created_at: z.string(),
}).openapi('Document');

export const EntityDocumentsQuerySchema = z.object({
  entity_table: z.string().min(1),
  entity_id: z.coerce.number().int().positive(),
});

export const IdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const DocumentDownloadResponseSchema = z.object({
  url: z.string(),
  filename: z.string(),
  expires_at: z.string(),
}).openapi('DocumentDownloadResponse');

export const UploadedDocumentSchema = z.object({
  id: z.number(),
  object_key: z.string(),
  original_filename: z.string(),
  size_bytes: z.number(),
  sha256: z.string(),
}).openapi('UploadedDocument');

export const UploadDocumentFormSchema = z.object({
  file: z.instanceof(File).openapi({ type: 'string', format: 'binary' }),
  entity_table: z.string().trim().min(1),
  entity_id: z.coerce.number().int().positive(),
  field: z.string().default('attachment'),
  label: z.string().optional(),
});

export const EntityDocumentsResponseSchema = z.array(DocumentSchema).openapi('EntityDocumentsResponse');
export const UnlinkedDocumentsResponseSchema = z.array(DocumentSchema).openapi('UnlinkedDocumentsResponse');

