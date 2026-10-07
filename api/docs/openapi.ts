import type { OpenAPIHono } from '@hono/zod-openapi';

/**
 * Metadata OpenAPI terpisah dari app.ts.
 *
 * app.doc() tetap harus dipanggil di instance yang memegang route,
 * tetapi isi spec (info, servers, dsb.) tinggal di sini supaya app.ts
 * hanya fokus merangkai route.
 */
export const openapiConfig = {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'codebase-hono API',
    description:
      'Boilerplate Bun + Hono + SQLite dengan pemisahan command/query.',
  },
  servers: [{ url: '/', description: 'current host' }],
};

/** Pasang endpoint /openapi.json di instance app. */
export const mountOpenApi = (app: OpenAPIHono) => {
  app.doc('/openapi.json', openapiConfig);
};
