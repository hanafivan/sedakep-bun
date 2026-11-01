import type { AuthUser } from '../../middleware/bearerAuth';
import { successBody } from '../../shared/response';
import type { AppRouteHandler } from '../../shared/types';
import * as domain from './domain';
import * as routes from './leave-letters.routes';

const actor = (c: { get: (key: 'user') => AuthUser }): AuthUser => c.get('user');

const toUpload = async (file: File) => ({
  buffer: Buffer.from(await file.arrayBuffer()),
  filename: file.name || 'berkas',
  mimeType: file.type || null,
});

export const lettersList: AppRouteHandler<routes.LettersListRoute> = async (c) => {
  const query = c.req.valid('query');
  const result = await domain.listLetters({
    letterType: query.letter_type,
    search: query.search,
    page: query.page,
    perPage: query.per_page,
  });
  return c.json(successBody(result, 'Daftar surat keterangan'), 200);
};

export const requestLetters: AppRouteHandler<routes.RequestLettersRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const letters = await domain.getLettersForRequest(id);
  return c.json(successBody(letters as Array<Record<string, unknown>>, 'Surat permohonan'), 200);
};

export const issueLetter: AppRouteHandler<routes.IssueLetterRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const isMultipart = (c.req.header('content-type') ?? '').includes('multipart/form-data');
  const body = isMultipart ? c.req.valid('form') : c.req.valid('json');
  const file = isMultipart && 'file' in body && body.file instanceof File ? body.file : null;
  const result = await domain.issueLetter({
    leave_request_id: id,
    letter_type: (String(body.letter_type ?? 'suket') as 'suket' | 'suket_madrasah'),
    number: (body.number as string | undefined) ?? null,
    issued_at: (body.issued_at as string | undefined) ?? null,
    official_position: (body.official_position as string | undefined) ?? null,
    official_name: (body.official_name as string | undefined) ?? null,
    attachment: file ? await toUpload(file) : null,
    actorId: Number(actor(c).id),
  });
  return c.json(successBody(result, 'Surat keterangan diterbitkan'), 200);
};

export const letterFile: AppRouteHandler<routes.LetterFileRoute> = async (c) => {
  const { id } = c.req.valid('param');
  const form = c.req.valid('form');
  const result = await domain.attachLetterFile({
    leave_letter_id: id,
    ...(await toUpload(form.file)),
    actorId: Number(actor(c).id),
  });
  return c.json(successBody(result, 'Berkas surat tersimpan'), 200);
};

export const revokeLetter: AppRouteHandler<routes.RevokeLetterRoute> = async (c) => {
  const { id, letter_type } = c.req.valid('param');
  await domain.revokeLetter({ leave_request_id: id, letter_type }, Number(actor(c).id));
  return c.json(successBody(null, 'Surat keterangan dicabut'), 200);
};

