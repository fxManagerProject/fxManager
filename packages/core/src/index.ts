import './config/env';

import { applyMigrations } from '@fxmanager/database';
import { processManager } from './process/manager';
import { startPanel } from '../../panel/src/index';

// ─── Bootstrap ────────────────────────────────────────────────────────────────

console.log('[core] FiveM Panel starting...');

// 1. Run DB migrations
applyMigrations();

// 2. Start the web panel
startPanel(processManager);

// 3. Graceful shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal: string) {
  console.log(`\n[core] Received ${signal}, shutting down...`);
  try {
    if (processManager.getState().status === 'running') {
      await processManager.stop();
    }
  } catch {
    /* ignore */
  }
  process.exit(0);
}

export { processManager };
