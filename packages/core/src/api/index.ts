import Elysia from 'elysia';
import { cors } from '@elysiajs/cors';
import { resourceAuth } from './middleware/auth';
import type { GameHandler } from '../services/game/handler';
import { playerRoutes } from './routes/players';

interface CoreAPIStartParams {
  gm: GameHandler;
  port?: number;
}

export function startAPI({ port = 4005, gm }: CoreAPIStartParams) {
  const app = new Elysia()
    .use(cors())
    .get('/api/health', () => ({ ok: true, ts: Date.now() }))

    .use(resourceAuth)
    .use(playerRoutes(gm));

  app.listen(port, () => {
    console.log(`[core - api] running at http://localhost:${port}`);
  });

  return app;
}
