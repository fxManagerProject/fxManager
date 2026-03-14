import { LogSegment, ServerConfig } from '@fxmanager/types';
import { colorIdToHex } from './data';
import { join } from 'node:path';

export const isDev = process.env.NODE_ENV === 'development';

export function getHexColourFromAnsi(index: number): string {
  return colorIdToHex[index] ?? '#ffffff';
}

export function parseAnsiToSegments(ansiStr: string): LogSegment[] {
  // look into 'ansi-to-json' package
  const ansiRegex = /\x1B\[([0-9;]*)m/g;
  let parts = ansiStr.split(ansiRegex);
  const segments: LogSegment[] = [];

  let currentColor = '';

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      // This is text
      if (parts[i]) {
        segments.push({ text: parts[i], color: currentColor });
      }
    } else {
      // This is an ANSI code
      const code = parts[i];
      if (code === '0') currentColor = '';
      else if (code.startsWith('38;5;')) {
        // fxserver uses 256-color palette
        const colorIndex = code.split(';')[2];
        currentColor = getHexColourFromAnsi(parseInt(colorIndex));
      }
    }
  }
  return segments;
}

export async function getCoreVersion(): Promise<ServerConfig['version']> {
  if (isDev) {
    const path = join(import.meta.dirname, '..', '..', '..', '..', 'package.json');
    const file = Bun.file(path);

    const pkg = await file.json();
    return pkg.version;
  } else {
    return (process.env.VERSION as ServerConfig['version']) ?? '0.0.0';
  }
}
