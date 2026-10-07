import { serve } from 'bun';
import { config } from './config';
import { app } from './app';

const port = config.port;

serve({
  port,
  fetch: app.fetch,
});

console.log(`API running at http://localhost:${port}`);
