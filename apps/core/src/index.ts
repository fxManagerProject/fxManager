import './common/env';

import path, { join } from 'node:path';
import { readFileSync } from 'node:fs';
import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import fastifyCookie from '@fastify/cookie';
import { isFxManagerSetup, isProduction } from './common/utils';
import { checkVersion } from './common/version_check';
import apiRoutes from './routes/api';
import internalRoutes from './routes/internal';
import { processManager } from './modules/process/manager';
import { gameManager } from './modules/game/manager';
import { ConfigManager } from './modules/config/manager';
import { perfManager } from './modules/perf/manager';
import { sessionManager } from './modules/session/manager';
import { restartScheduler } from './modules/schedule/manager';
import { applyMigrations } from '@fxmanager/database';
import { MIGRATE_WORKER_FLAG, runMigrateWorker } from './migrate-worker';

// when re-exec'd as a migrate worker, run the import and exit before any
// server/port/migration bootstrapping happens
if (process.argv.includes(MIGRATE_WORKER_FLAG)) {
	await runMigrateWorker();
}

applyMigrations();
// hardcode for the time being
// checkVersion(isProduction ? process.env.VERSION as string : 'dev-build');
checkVersion('dev-build');

const cm = ConfigManager.getInstance();
const { cookieSecret, webServerPort } = cm.getSystemValues();
const fastify = Fastify({ logger: !isProduction, forceCloseConnections: true });

fastify.register(fastifyCookie, {
	secret: cookieSecret,
});
fastify.register(fastifyWebsocket);

if (isProduction) {
	const distPath = path.join(process.cwd(), './assets');

	fastify.register(fastifyStatic, {
		root: distPath,
		prefix: '/',
		// disable automatic index.html serving
		index: false,
		// disable fastify static 404 handler
		wildcard: false,
	});

	fastify.get('/*', (request, reply) => {
		fastify.log.info(`new req: ${request.url}`);

		if (request.url.match(/\.(js|css|png|ico|svg|woff2?)(\?.*)?$/)) {
			return reply.sendFile(request.url.slice(1));
		}

		if (isFxManagerSetup()) {
			return reply.sendFile('index.html');
		}

		const template = readFileSync(join(distPath, 'index.html'), 'utf-8');

		const html = template.replace(
			'<head>',
			`<head><script>window.__SETUP_REQUIRED__ = ${true};</script>`,
		);

		reply.type('text/html').send(html);
	});
}

// API routes
fastify.get('/api/health', async () => {
	return { status: 'ok' };
});

const pm = processManager;
const gm = gameManager;

perfManager.start();
sessionManager.init();
restartScheduler.start(pm);

fastify.register(apiRoutes, { prefix: '/api', pm, gm });
fastify.register(internalRoutes, { prefix: '/internal', pm, gm });

if (!isProduction) {
	const devUrl = 'http://localhost:5173';
	const commonStyles = `
    background: #121212; 
    color: #e0e0e0; 
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
    margin: 0; 
    display: flex; 
    flex-direction: column; 
    align-items: center; 
    justify-content: center; 
    height: 100vh;
  `;

	fastify.get('/routemap', (_, reply) => {
		const routes = fastify.printRoutes({
			commonPrefix: true,
			includeMeta: ['preHandler'],
		});

		reply.type('text/html; charset=utf-8').send(`
        <html>
          <body style="${commonStyles} justify-content: flex-start; padding: 2rem; height: auto; display: block;">
            <div style="max-width: 900px; margin: 0 auto;">
              <h2 style="color: #4fc1ff; margin-bottom: 0.5rem;">⚙️ Fastify Route Map</h2>
              <p style="color: #888; margin-bottom: 2rem;">Development Environment Only</p>
              <pre style="background: #1e1e1e; padding: 1.5rem; border-radius: 8px; border: 1px solid #333; overflow-x: auto; line-height: 1.5; color: #d4d4d4; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">${routes}</pre>
              <div style="margin-top: 2rem;">
                <a href="/" style="color: #4fc1ff; text-decoration: none;">&larr; Back to Redirect</a>
              </div>
            </div>
          </body>
        </html>
      `);
	});

	fastify.get('/', (_, reply) => {
		reply.type('text/html; charset=utf-8').send(`
        <html>
          <head>
            <meta http-equiv="refresh" content="3;url=${devUrl}" />
          </head>
          <body style="${commonStyles}">
            <div style="text-align: center; background: #1e1e1e; padding: 3rem; border-radius: 16px; border: 1px solid #333; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
              <div style="font-size: 3rem; margin-bottom: 1rem;">🚀</div>
              <h2 style="margin: 0; color: #fff;">Development Mode</h2>
              <p style="color: #888; margin: 1rem 0 2rem 0;">Redirecting to Vite Frontend...</p>
              
              <a href="${devUrl}" style="display: inline-block; background: #4fc1ff; color: #121212; padding: 0.8rem 1.5rem; border-radius: 6px; font-weight: bold; text-decoration: none; transition: opacity 0.2s;">
                Launch App Now
              </a>

              <div style="margin-top: 2.5rem; border-top: 1px solid #333; padding-top: 1.5rem;">
                <a href="/routemap" style="color: #888; text-decoration: none; font-size: 0.9rem;">
                  View API Route Map &rarr;
                </a>
              </div>
            </div>
          </body>
        </html>
      `);
	});

	fastify.ready(() => {
		console.log(`[dev] API available at: http://localhost:${webServerPort}`);
		console.log(`[dev] Route map: http://localhost:${webServerPort}/routemap`);
	});
}

const start = async () => {
	try {
		await fastify.listen({ port: webServerPort, host: '0.0.0.0' });
		console.log(
			`[core] Fastify server listening on http://localhost:${webServerPort}`,
		);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
};

// Stop the supervised FXServer before exiting so `docker stop` / Ctrl+C shut the child down cleanly instead of orphaning it
let shuttingDown = false;
const shutdown = async (signal: string) => {
	if (shuttingDown) return;
	shuttingDown = true;
	console.log(`[core] Received ${signal}, shutting down`);
	try {
		await pm.stop();
		await fastify.close();
	} catch (err) {
		console.error('[core] Error during shutdown', err);
	} finally {
		process.exit(0);
	}
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
