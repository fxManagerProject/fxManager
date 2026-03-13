import './config/env';

import { loadConfig } from './config';
import { applyMigrations } from '@fxmanager/database';
import { startPanel } from '../../panel/src/index';
import { startAPI } from './api';
import { ProcessManager } from './services/process/manager';
import { GameManager } from './services/game/manager';

console.log('[core] FiveM Panel starting...');

const { webServerPort, internalPort } = loadConfig();
const processManager = new ProcessManager();
const gameManager = new GameManager(processManager);

// check and update database migrations
applyMigrations();

// initialize the internal API endpoint
startAPI({
  port: internalPort,
  gm: gameManager,
});

// initialize the web panel
startPanel({
  port: webServerPort,
  pm: processManager,
});

// handle resource shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal: string) {
  console.log(`\n[core] Received ${signal}, shutting down...`);
  try {
    if (processManager.getState().status === 'running') {
      await processManager.stop();
    }
  } catch (err) {
    console.error('Failed to run shutdown functions !');
    console.error(err);
  }
  process.exit(0);
}

export { processManager };
