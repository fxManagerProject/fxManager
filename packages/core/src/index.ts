import './config/env';

// critical first step
import { applyMigrations } from '@fxmanager/database';
applyMigrations();

import { loadConfig } from './config';
import { ProcessManager } from './services/process/manager';
import { GameManager } from './services/game/manager';
import { closureMessage } from './common/fancy_stuff';
import { checkVersion } from './common/version_check';

const { webServerPort, internalPort, version } = loadConfig();
const processManager = new ProcessManager();
const gameManager = new GameManager(processManager);

// initialize API and Panel dynamically
const { startPanel } = await import('../../panel/src/index');
const { startAPI } = await import('./api');

startAPI({
  port: internalPort,
  gm: gameManager,
});

startPanel({
  port: webServerPort,
  pm: processManager,
});

checkVersion(version);

// handle resource shutdown
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

async function shutdown(signal: string) {
  console.log(`[core] Received ${signal}, shutting down...`);
  try {
    if (processManager.getState().status === 'running') {
      await processManager.stop();
    }
  } catch (err) {
    console.error('Failed to run shutdown functions !');
    console.error(err);
  }

  await closureMessage();
  process.exit(0);
}

export { processManager };
