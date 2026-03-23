import Elysia from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import type { IGameManager, IProcessManager } from '@fxmanager/types';
import { wsRoutes } from './ws';
import { isDev } from '../common/utils';
import { authRoutes, gameRoutes, playerRoutes, serverRoutes } from './routes/panel';
import { playerApiRoutes } from './routes/api';
import { resourceAuth } from './middleware/auth';

function resolvePublicDir(): string {
  return join(dirname(process.execPath), 'public');
}

interface PanelStartParams {
  pm: IProcessManager;
  gm: IGameManager;
  port?: number;
}

export function startPanel({ pm, gm, port = 4000 }: PanelStartParams) {
  // biome-ignore format: maintain route grouping layout
  const app = new Elysia()
    .use(cors())
    .get('/api/health', () => ({ ok: true, ts: Date.now() }))
    // apî routes
    .group('/internal', (app) => 
      app
        .use(resourceAuth)
        .use(playerApiRoutes(gm))
    )
    // panel routes
    .group('/api', (app) =>
      app
        .use(authRoutes)
        .use(serverRoutes(pm))
        .use(playerRoutes(gm))
        .use(gameRoutes(gm)),
    )
    .use(wsRoutes(pm, gm));

  if (isDev) {
    console.log('[panel] Dev mode — Vite client on http://localhost:5173');

    // app.onBeforeHandle(({ request, body }) => {
    //   console.log('[panel - req] Method:', request.method)
    //   console.log('[panel - req] Raw Headers:', request.headers.get('content-type'))
    //   console.log('[panel - req] Parsed Body:', typeof body, body)
    // });
  } else {
    const publicDir = resolvePublicDir();

    if (existsSync(publicDir)) {
      // Serve static assets (JS, CSS, images, etc.)
      app.use(staticPlugin({ assets: publicDir, prefix: '/' }));
      // SPA fallback — all unmatched routes return index.html
      app.get('/*', () => Bun.file(join(publicDir, 'index.html')));
      console.log(`[panel] Serving UI from ${publicDir}`);
    } else {
      console.warn(`[panel] No public/ dir found at ${publicDir} — UI unavailable`);
    }
  }

  app.listen(port, () => {
    console.log(`[panel] Web panel running at http://localhost:${port}`);
  });

  return app;
}
