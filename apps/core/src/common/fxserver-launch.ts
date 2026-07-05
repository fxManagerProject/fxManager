import { existsSync } from 'node:fs';
import path from 'node:path';
import type { PlatformOS } from '@fxmanager/shared/types';

const MUSL_LOADER = 'ld-musl-x86_64.so.1';

/**
 * Locate the musl dynamic loader shipped alongside a Linux FXServer artifact.
 * Returns null on non-Linux platforms or when the loader isn't present next to
 * the executable (e.g. a glibc build or a wrapper script).
 */
export function resolveMuslLoader(
	executablePath: string,
	platform: PlatformOS,
): string | null {
	if (platform !== 'linux') return null;
	const loader = path.join(path.dirname(executablePath), MUSL_LOADER);
	return existsSync(loader) ? loader : null;
}

/**
 * Build the argv used to spawn FXServer.
 *
 * On Linux the alpine artifact is a musl-linked binary that can't be exec'd
 * directly — its ELF interpreter is absent on glibc hosts, so posix_spawn fails
 * with ENOENT. It must be launched through the musl loader with the artifact's
 * library paths and citizen_dir, mirroring the shipped run.sh.
 */
export function buildFxServerCommand(
	executablePath: string,
	args: string[],
	muslLoader: string | null,
): string[] {
	if (!muslLoader) return [executablePath, ...args];

	const cfxServerDir = path.posix.dirname(executablePath);
	const alpineRoot = path.posix.dirname(path.posix.dirname(cfxServerDir));
	const libraryPath = [
		path.posix.join(alpineRoot, 'usr', 'lib', 'v8'),
		path.posix.join(alpineRoot, 'lib'),
		path.posix.join(alpineRoot, 'usr', 'lib'),
	].join(':');

	return [
		muslLoader,
		'--library-path',
		libraryPath,
		'--',
		executablePath,
		'+set',
		'citizen_dir',
		path.posix.join(cfxServerDir, 'citizen'),
		...args,
	];
}
