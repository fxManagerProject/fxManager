/**
 * biome-ignore-all lint/suspicious/noExplicitAny: fakes for repo/stat are cast
 * to satisfy handler options & mocked module shapes
 */
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	mock,
} from 'bun:test';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCookie from '@fastify/cookie';
import path from 'node:path';

const mockSettingsSet = mock(() => {});
const mockGroupsList = mock(() => []);
const mockGroupsDelete = mock(() => {});
const mockGroupsCreate = mock(() => {});
const mockCountUsers = mock(() => 0);
const mockCreateUser = mock(async (username: string) => ({
	id: 1,
	username,
}));
const mockCreateSession = mock((_userId: number) => ({ id: 'test-session' }));

mock.module('@fxmanager/database', () => ({
	repo: {
		settings: { set: mockSettingsSet },
		groups: {
			list: mockGroupsList,
			delete: mockGroupsDelete,
			create: mockGroupsCreate,
		},
		auth: {
			countUsers: mockCountUsers,
			createUser: mockCreateUser,
			createSession: mockCreateSession,
		},
	},
}));

const fileSystem = new Map<string, 'file' | 'dir'>();
const mockStat = mock(async (targetPath: string) => {
	const normalizedPath = path.normalize(targetPath);
	const type = fileSystem.get(normalizedPath);

	if (!type)
		throw new Error(
			`ENOENT: no such file or directory, stat '${normalizedPath}'`,
		);

	return {
		isDirectory: () => type === 'dir',
		isFile: () => type === 'file',
	};
});

mock.module('node:fs/promises', () => ({
	stat: mockStat,
	access: async () => {},
}));

import { ConfigManager } from '../../modules/config/manager';
import { setupTokenManager } from '../../modules/setup/token';
import SetupModule from './setup';

describe('setup endpoint (HTTP)', () => {
	let app: FastifyInstance;
	let token: string;
	let originalPlatform: NodeJS.Platform;

	const setPlatform = (platform: NodeJS.Platform) => {
		Object.defineProperty(process, 'platform', { value: platform });
	};

	const postSetup = (fxserverPath: string, resourcePath: string) =>
		app.inject({
			method: 'POST',
			url: '/setup',
			headers: {
				'content-type': 'application/json',
				'x-setup-token': token,
			},
			payload: {
				username: 'admin',
				password: 'password123',
				server: { method: 'manual', fxserverPath, resourcePath },
				customGroups: [],
			},
		});

	beforeAll(async () => {
		app = Fastify();
		await app.register(fastifyCookie);
		await app.register(SetupModule.handler, {
			prefix: SetupModule.prefix,
		} as any);
		await app.ready();
	});

	beforeEach(() => {
		originalPlatform = process.platform;
		fileSystem.clear();
		mockStat.mockClear();
		(ConfigManager as any).instance = null;
		token = setupTokenManager.ensure(); // the handler clears it on success

		for (const m of [
			mockSettingsSet,
			mockGroupsList,
			mockGroupsDelete,
			mockGroupsCreate,
			mockCountUsers,
			mockCreateUser,
			mockCreateSession,
		])
			m.mockClear();
	});

	afterEach(() => {
		Object.defineProperty(process, 'platform', { value: originalPlatform });
	});

	it('resolves an fxServer directory down to the child FXServer.exe before persisting (windows)', async () => {
		setPlatform('win32');
		const installRoot = path.resolve('fake-install-root');
		const fxServerDir = path.join(installRoot, 'fxServer');
		const exePath = path.join(fxServerDir, 'FXServer.exe');
		const dataDir = path.join(installRoot, 'server-data');

		fileSystem.set(installRoot, 'dir');
		fileSystem.set(fxServerDir, 'dir');
		fileSystem.set(exePath, 'file');
		fileSystem.set(dataDir, 'dir');

		const res = await postSetup(fxServerDir, dataDir);

		expect(res.statusCode).toBe(201);
		expect(mockSettingsSet).toHaveBeenCalledWith(
			'fxserver.executablePath',
			exePath,
		);
		expect(mockSettingsSet).toHaveBeenCalledWith(
			'fxserver.serverDataPath',
			dataDir,
		);
		// the raw directory must never be what gets stored
		expect(mockSettingsSet).not.toHaveBeenCalledWith(
			'fxserver.executablePath',
			fxServerDir,
		);
	});

	it('persists a direct executable file path unchanged', async () => {
		setPlatform('win32');
		const exePath = path.resolve('bin', 'FXServer.exe');
		const dataDir = path.resolve('server-data');

		fileSystem.set(path.dirname(exePath), 'dir');
		fileSystem.set(exePath, 'file');
		fileSystem.set(dataDir, 'dir');

		const res = await postSetup(exePath, dataDir);

		expect(res.statusCode).toBe(201);
		expect(mockSettingsSet).toHaveBeenCalledWith(
			'fxserver.executablePath',
			exePath,
		);
	});

	it('resolves nested Linux alpine fxserver directories', async () => {
		setPlatform('linux');
		const installRoot = path.resolve('fake-install-root');
		const fxServerDir = path.join(installRoot, 'fxserver');
		const alpineDir = path.join(fxServerDir, 'alpine', 'opt', 'cfx-server');
		const exePath = path.join(alpineDir, 'fxserver');
		const dataDir = path.join(installRoot, 'server-data');

		fileSystem.set(installRoot, 'dir');
		fileSystem.set(fxServerDir, 'dir');
		fileSystem.set(alpineDir, 'dir');
		fileSystem.set(exePath, 'file');
		fileSystem.set(dataDir, 'dir');

		const res = await postSetup(fxServerDir, dataDir);

		expect(res.statusCode).toBe(201);
		expect(mockSettingsSet).toHaveBeenCalledWith(
			'fxserver.executablePath',
			exePath,
		);
	});

	it('keeps an unresolvable path instead of rejecting (proceed-anyway support)', async () => {
		setPlatform('win32');
		const fxServerDir = path.resolve('empty-install');
		const dataDir = path.resolve('server-data');

		fileSystem.set(fxServerDir, 'dir');
		fileSystem.set(dataDir, 'dir');

		const res = await postSetup(fxServerDir, dataDir);

		expect(res.statusCode).toBe(201);
		expect(mockSettingsSet).toHaveBeenCalledWith(
			'fxserver.executablePath',
			fxServerDir,
		);
	});
});
