import type { ServerConfig } from '@fxmanager/types';

export const isDev = process.env.NODE_ENV === 'development';

export async function getVersion(): Promise<ServerConfig['version']> {
  if (isDev) {
    return 'dev-build';
  } else {
    return (process.env.VERSION as ServerConfig['version']) ?? '0.0.0';
  }
}
