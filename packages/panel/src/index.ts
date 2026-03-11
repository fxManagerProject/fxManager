import Elysia from 'elysia';
import { cors } from '@elysiajs/cors';
import { staticPlugin } from '@elysiajs/static';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import type { IProcessManager } from '@fxmanager/types';
import { serverRoutes } from './routes/server';
import { playerRoutes } from './routes/players';
import { resourceRoutes } from './routes/resource';
import { wsRoutes } from './ws';
import { authRoutes } from './routes/auth';

const isDev = process.env.NODE_ENV !== 'production';

// Resolve public dir relative to the running binary in production,
// or relative to the source file in dev.
function resolvePublicDir(): string {
  if (isDev) {
    return join(import.meta.dir, '../client/dist');
  }
  // process.execPath is the compiled binary's absolute path at runtime
  return join(dirname(process.execPath), 'public');
}

interface PanelStartParams {
  pm: IProcessManager;
  port?: number;
}

export function startPanel({ pm, port = 4000 }: PanelStartParams) {
  const app = new Elysia()
    .use(cors())

    // ── API ──────────────────────────────────────────────────────────────────
    .use(serverRoutes(pm))
    .use(playerRoutes)
    .use(resourceRoutes)
    .use(authRoutes)
    .use(wsRoutes(pm))
    .get('/api/health', () => ({ ok: true, ts: Date.now() }));

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
