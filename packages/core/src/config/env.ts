import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { openingMessage } from '../common/fancy_stuff';
import { isDev } from '../common/utils';

await openingMessage();

/* 
Ideally I shouldn't need to do this, but in the development environment it's not loading the .env
from the project root and looking in packages/core
*/

const envPath = isDev ? join(process.cwd(), '.env') : join(process.cwd(), '../..', '.env');

if (existsSync(envPath)) {
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
    if (!(key in process.env)) process.env[key] = value;
  }
  console.log(`[core] Loaded .env from ${envPath}`);
} else {
  console.warn(`[core] No .env found at ${envPath}`);
}
