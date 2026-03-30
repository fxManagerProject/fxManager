import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path, { join } from 'path';
import { isFxManagerSetup, isProduction } from './common/utils';
import { applyMigrations } from '@fxmanager/database';
import { checkVersion } from './common/version_check';
import apiRoutes from './routes/api';
import internalRoutes from './routes/internal';
import { readFileSync } from 'fs';

applyMigrations();
// hardcode for the time being
// checkVersion(isProduction ? process.env.VERSION as string : 'dev-build');
checkVersion('dev-build');

const fastify = Fastify({ logger: !isProduction });

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
      `<head><script>window.__SETUP_REQUIRED__ = ${true};</script>`
    );

    reply.type('text/html').send(html);
  });
}

// API routes
fastify.get('/api/health', async () => {
  return { status: 'ok' };
});

fastify.register(apiRoutes, { prefix: '/api' });
fastify.register(internalRoutes, { prefix: '/internal' });

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log(`[core] Fastify server listening on http://localhost:${3000}`)
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
