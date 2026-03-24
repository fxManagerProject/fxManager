import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { isProduction } from './common/utils';
import { applyMigrations } from '@fxmanager/database';
import { checkVersion } from './common/version_check';

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
  });

  // Handle SPA routing (redirect 404s to index.html so React Router works)
  fastify.setNotFoundHandler((request, reply) => {
    reply.sendFile('index.html');
  });
}

// API routes
fastify.get('/api/health', async () => {
  return { status: 'ok' };
});

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
