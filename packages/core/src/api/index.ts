import Elysia from 'elysia';
import { cors } from '@elysiajs/cors';
import { resourceAuth } from './middleware/auth';

interface CoreAPIStartParams {
  port?: number;
}

export function startPanel({ port = 4005 }: CoreAPIStartParams) {
  const app = new Elysia()
    .use(cors())
    .use(resourceAuth)

    // ── API ──────────────────────────────────────────────────────────────────
    .get('/api/health', () => ({ ok: true, ts: Date.now() }));

  app.listen(port, () => {
    console.log(`[core - api] running at http://localhost:${port}`);
  });

  return app;
}
