import type { Build, PluginBuilder } from 'bun';
import fs from 'node:fs/promises';
import path, { join } from 'node:path';
import { name, version } from '../package.json' with { type: 'json' };

const args = process.argv.slice(2);
const targetArg =
	args.find((a) => a.startsWith('--target='))?.split('=')[1] ?? 'all';

const ROOT_DIR = path.join(import.meta.dir, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const ASSETS_DIR = path.join(DIST_DIR, 'assets');
const RESOURCE_DIR = path.join(DIST_DIR, 'fxManager');
const CORE_ENTRY = join(ROOT_DIR, 'apps/core/src/index.ts');

const targets: Record<string, Build.CompileTarget> = {
	windows: 'bun-windows-x64',
	linux: 'bun-linux-x64',
} as const;

await fs.rm(DIST_DIR, { recursive: true, force: true });
await fs.mkdir(ASSETS_DIR, { recursive: true });
await fs.mkdir(RESOURCE_DIR, { recursive: true });

const webpanelDist = path.join(process.cwd(), 'apps/webpanel/dist');

/** Helper function to recursively copy files */
async function copyDir(src: string, dest: string) {
	await fs.mkdir(dest, { recursive: true });
	const entries = await fs.readdir(src, { withFileTypes: true });

	for (const entry of entries) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);

		if (entry.isDirectory()) {
			await copyDir(srcPath, destPath);
		} else {
			await fs.copyFile(srcPath, destPath);
		}
	}
}

/** Helper function to wait for files to exist */
async function waitForFile(filePath: string, timeout = 5000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		if (await Bun.file(filePath).exists()) return true;
		await new Promise((resolve) => setTimeout(resolve, 100)); // Sleep 100ms
	}
	throw new Error(
		`Timeout: File ${filePath} did not appear after ${timeout}ms`,
	);
}

await copyDir(webpanelDist, ASSETS_DIR);

const resourceDist = path.join(process.cwd(), 'apps/resource');

await Promise.all(
	['locales', 'static', 'dist'].map(async (localPath) => {
		const path = join(resourceDist, localPath);
		const targetpath = join(RESOURCE_DIR, localPath);
		await copyDir(path, targetpath);
	}),
);

await Promise.all(
	['fxmanifest.lua', 'README.md', '.yarn.installed'].map(async (localPath) => {
		const src = join(resourceDist, localPath);
		const dest = join(RESOURCE_DIR, localPath);

		try {
			await waitForFile(src);
			await fs.copyFile(src, dest);
		} catch (err) {
			console.error(`Failed to copy ${localPath}:`, (err as Error).message);
			process.exit(1);
		}
	}),
);

// define target to build for
const toBuild =
	targetArg === 'all'
		? Object.entries(targets)
		: [[targetArg, targets[targetArg as keyof typeof targets]]];

// plugin to remove DEV: labels
const stripDevLabels = {
	name: 'strip-dev-labels',
	setup(build: PluginBuilder) {
		build.onLoad({ filter: /\.(ts|tsx)$/ }, async (args) => {
			const text = await Bun.file(args.path).text();
			return {
				contents: text.replaceAll(/^\s*DEV:.*$/gm, ''),
				loader: 'ts',
			};
		});
	},
};

const buildResults = [];
for (const [platform, target] of toBuild) {
	const ext = platform === 'windows' ? '.exe' : '';
	const filename = `${name}-${platform}`;
	const outfile = join(DIST_DIR, `${filename}${ext}`);

	const buildSettings = {
		entrypoints: [CORE_ENTRY],
		outdir: DIST_DIR,
		compile: {
			target: target as Build.CompileTarget,
			outfile,
		},
		define: {
			'process.env.NODE_ENV': JSON.stringify('production'),
			'process.env.VERSION': JSON.stringify(version),
		},
		plugins: [stripDevLabels],
	};

	const result = await Bun.build(buildSettings);

	if (result.success) {
		const file = Bun.file(outfile);
		const sizeMB = (file.size / (1024 * 1024)).toFixed(2);

		buildResults.push({
			Platform: platform.toUpperCase(),
			Filename: filename,
			Size: `${sizeMB} MB`,
			Status: '✅ Success',
		});
	} else {
		buildResults.push({
			Platform: platform.toUpperCase(),
			Filename: filename,
			Size: '-',
			Status: '❌ Failed',
		});
		console.error(`Build failed for ${platform}:`, result.logs);
	}
}

console.log(`\n${'='.repeat(60)}`);
console.log(`📦 FXMANAGER BUILD SUMMARY (v${version})`);
console.log('='.repeat(60));
console.table(buildResults);
console.log(`\n📂 Artifacts directory: ${DIST_DIR}`);
console.log(`\n${'='.repeat(60)}`);
