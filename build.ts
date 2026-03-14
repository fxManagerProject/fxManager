#!/usr/bin/env bun
/**
 * Build script — produces distributable binaries for Windows and Linux
 * Usage: bun run build.ts [--target windows|linux|all]
 *
 * Output structure:
 *   dist/
 *     fxmanager-linux          ← Linux binary
 *     fxmanager-windows.exe    ← Windows binary
 *     public/                  ← React SPA
 *     resource/                ← FiveM resource
 */

import { Build, type PluginBuilder } from 'bun';
import { mkdirSync, cpSync } from 'fs';
import { join } from 'path';
import { version } from './package.json' with { type: 'json' };

const args = process.argv.slice(2);
const targetArg = args.find((a) => a.startsWith('--target='))?.split('=')[1] ?? 'all';

const DIST = join(import.meta.dir, 'dist');
const ENTRY = join(import.meta.dir, 'packages/core/src/index.ts');
const CLIENT_DIST = join(import.meta.dir, 'packages/panel-ui/dist');
const RESOURCE_DIST = join(import.meta.dir, 'packages/resource');

const targets: Record<string, Build.CompileTarget> = {
  windows: 'bun-windows-x64',
  linux: 'bun-linux-x64',
} as const;

mkdirSync(DIST, { recursive: true });

console.log('📦 Compiling binaries...');

const toBuild =
  targetArg === 'all'
    ? Object.entries(targets)
    : [[targetArg, targets[targetArg as keyof typeof targets]]];

const stripDevLabels = {
  name: 'strip-dev-labels',
  setup(build: PluginBuilder) {
    build.onLoad({ filter: /\.(ts|tsx)$/ }, async (args: any) => {
      const text = await Bun.file(args.path).text();
      return {
        contents: text.replaceAll(/^\s*DEV:.*$/gm, ''),
        loader: 'ts',
      };
    });
  },
};

for (const [name, target] of toBuild) {
  const ext = name === 'windows' ? '.exe' : '';
  const filename = `fxmanager-${name}`;

  console.log(`  → ${name}: ${filename}${ext}`);

  const buildSettings = {
    entrypoints: [ENTRY],
    outdir: DIST,
    compile: {
      target: target as Build.CompileTarget,
      outfile: join(DIST, `${filename}${ext}`),
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      'process.env.VERSION': JSON.stringify(version),
    },
    plugins: [stripDevLabels],
  };

  await Bun.build(buildSettings);
}

console.log('🌐 Copying panel-ui assets...');

const publicOut = join(DIST, 'public');
mkdirSync(publicOut, { recursive: true });
cpSync(CLIENT_DIST, publicOut, { recursive: true });

console.log('📁 Copying FiveM resource...');

const filesToCopy = ['dist', 'locales', 'static', 'fxmanifest.lua'];

const resourceOut = join(DIST, 'resource');
mkdirSync(publicOut, { recursive: true });
filesToCopy.forEach((file) => {
  const src = join(RESOURCE_DIST, file);
  console.log('src', src);
  const dest = join(resourceOut, file);

  cpSync(src, dest, { recursive: true });
});

console.log(`
✅ Build complete!

  dist/
  ├── fxmanager-linux          ← Linux binary
  ├── fxmanager-windows.exe    ← Windows binary
  ├── public/                  ← React SPA
  └── resource/                ← Fivem Resource

⚠️  The public/ folder must remain next to the binary when deploying.
`);
