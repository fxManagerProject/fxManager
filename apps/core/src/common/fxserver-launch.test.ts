import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildFxServerCommand, resolveMuslLoader } from './fxserver-launch';

describe('buildFxServerCommand', () => {
	const args = ['+exec', 'server.cfg', '+set', 'onesync', 'on'];

	it('spawns the executable directly when no musl loader is present', () => {
		expect(buildFxServerCommand('FXServer.exe', args, null)).toEqual([
			'FXServer.exe',
			...args,
		]);
	});

	it('wraps the executable in the musl loader with library paths and citizen_dir on Linux', () => {
		const executable = '/root/artifacts/alpine/opt/cfx-server/FXServer';
		const loader = '/root/artifacts/alpine/opt/cfx-server/ld-musl-x86_64.so.1';

		expect(buildFxServerCommand(executable, args, loader)).toEqual([
			loader,
			'--library-path',
			'/root/artifacts/alpine/usr/lib/v8:/root/artifacts/alpine/lib:/root/artifacts/alpine/usr/lib',
			'--',
			executable,
			'+set',
			'citizen_dir',
			'/root/artifacts/alpine/opt/cfx-server/citizen',
			...args,
		]);
	});
});

describe('resolveMuslLoader', () => {
	it('returns null on Windows', () => {
		expect(resolveMuslLoader('C:/fxserver/FXServer.exe', 'windows')).toBeNull();
	});

	it('returns null on an unknown platform', () => {
		expect(resolveMuslLoader('/opt/cfx-server/FXServer', 'unknown')).toBeNull();
	});

	describe('on Linux', () => {
		let dir: string;

		beforeEach(() => {
			dir = mkdtempSync(path.join(tmpdir(), 'fxlaunch-'));
		});

		afterEach(() => {
			rmSync(dir, { recursive: true, force: true });
		});

		it('returns the loader path when it sits next to the executable', () => {
			const loader = path.join(dir, 'ld-musl-x86_64.so.1');
			writeFileSync(loader, '');
			expect(resolveMuslLoader(path.join(dir, 'FXServer'), 'linux')).toBe(
				loader,
			);
		});

		it('returns null when the loader is missing next to the executable', () => {
			expect(
				resolveMuslLoader(path.join(dir, 'FXServer'), 'linux'),
			).toBeNull();
		});
	});
});
