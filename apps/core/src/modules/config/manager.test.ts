/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows testing hidden state properties & mocking frames */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import path from 'node:path';

const mockGetMultiple = mock<() => Record<string, unknown>>(() => ({}));
const mockAll = mock<() => Array<{ key: string; value: any }>>(() => []);
const mockSet = mock(() => {});

mock.module('@fxmanager/database', () => ({
	repo: {
		settings: {
			getMultiple: mockGetMultiple,
			all: mockAll,
			set: mockSet,
		},
		players: {},
		whitelist: {},
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
}));

import { ConfigManager } from './manager';

describe('ConfigManager', () => {
	let originalEnv: typeof process.env;
	let originalPlatform: NodeJS.Platform;

	// Helper to override OS platform
	const setPlatform = (platform: NodeJS.Platform) => {
		Object.defineProperty(process, 'platform', { value: platform });
	};

	beforeEach(() => {
		originalEnv = { ...process.env };

		delete process.env.FXSERVER_EXECUTABLE;
		delete process.env.FXSERVER_DATA_PATH;
		delete process.env.FXSERVER_CFG;
		delete process.env.PANEL_PORT;
		delete process.env.COOKIE_SECRET;

		originalPlatform = process.platform;
		fileSystem.clear();
		mockStat.mockClear();

		(ConfigManager as any).instance = null;
	});

	afterEach(() => {
		process.env = originalEnv;
		Object.defineProperty(process, 'platform', { value: originalPlatform });
		(ConfigManager as any).instance = null;
	});

	describe('getInstance', () => {
		it('returns the same instance across multiple invocations', () => {
			const instance1 = ConfigManager.getInstance();
			const instance2 = ConfigManager.getInstance();
			expect(instance1).toBe(instance2);
		});
	});

	describe('systemValues (Initialization)', () => {
		it('resolves windows platform appropriately', () => {
			Object.defineProperty(process, 'platform', { value: 'win32' });
			const config = ConfigManager.getInstance();
			expect(config.getSystemValues().platform).toBe('windows');
		});

		it('resolves non-windows platform as linux', () => {
			Object.defineProperty(process, 'platform', { value: 'darwin' });
			const config = ConfigManager.getInstance();
			expect(config.getSystemValues().platform).toBe('linux');
		});

		it('uses specified PANEL_PORT environment variable', () => {
			process.env.PANEL_PORT = '4000';
			const config = ConfigManager.getInstance();
			expect(config.getSystemValues().webServerPort).toBe(4000);
		});

		it('defaults webServerPort to 3000 if environment variable is missing', () => {
			delete process.env.PANEL_PORT;
			const config = ConfigManager.getInstance();
			expect(config.getSystemValues().webServerPort).toBe(3000);
		});

		it('generates a valid UUID for resourceApiToken', () => {
			const config = ConfigManager.getInstance();
			expect(config.getSystemValues().resourceApiToken).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			);
		});

		it('uses COOKIE_SECRET from environment if available', () => {
			process.env.COOKIE_SECRET = 'super-secret-cookie';
			const config = ConfigManager.getInstance();
			expect(config.getSystemValues().cookieSecret).toBe('super-secret-cookie');
		});
	});

	describe('regenerateApiToken', () => {
		it('changes the resourceApiToken value on invocation', () => {
			const config = ConfigManager.getInstance();
			const initialToken = config.getSystemValues().resourceApiToken;

			config.regenerateApiToken();
			const secondaryToken = config.getSystemValues().resourceApiToken;

			expect(initialToken).not.toBe(secondaryToken);
			expect(secondaryToken).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
			);
		});
	});

	describe('getFxServerValues', () => {
		it('returns baseline static config values without db flag', () => {
			process.env.FXSERVER_EXECUTABLE = './run.sh';
			const config = ConfigManager.getInstance();

			const fxValues = config.getFxServerValues(false);
			expect(fxValues.executablePath).toBe('./run.sh');
			expect(fxValues.onesync).toBe('on');
			expect(mockGetMultiple).not.toHaveBeenCalled();
		});

		it('merges values from database persistent layer when useDb is true', () => {
			mockGetMultiple.mockReturnValue({
				'fxserver.executablePath': './custom-FXServer',
				'fxserver.onesync': 'off',
				'fxserver.serverConfigPath': 'custom.cfg',
			});

			const config = ConfigManager.getInstance();
			const fxValues = config.getFxServerValues(true);

			expect(mockGetMultiple).toHaveBeenCalledWith([
				'fxserver.onesync',
				'fxserver.executablePath',
				'fxserver.serverDataPath',
				'fxserver.serverConfigPath',
			]);
			expect(fxValues.executablePath).toBe('./custom-FXServer');
			expect(fxValues.onesync).toBe('off'); // onesync is read from the db
			expect(fxValues.serverConfigFile).toBe('custom.cfg'); // serverConfigPath key maps to the serverConfigFile field
			expect(fxValues.serverDataPath).toBe('./server-data'); // Kept fallback
		});

		it('ignores undefined database properties safely', () => {
			mockGetMultiple.mockReturnValue({
				'fxserver.executablePath': undefined,
				'fxserver.onesync': 'on',
			});

			const config = ConfigManager.getInstance();
			const fxValues = config.getFxServerValues(true);

			expect(fxValues.executablePath).toBe('./FXServer'); // Restores baseline fallback
			expect(fxValues.onesync).toBe('on');
		});
	});

	describe('getAllValues', () => {
		it('combines system and server settings seamlessly without db', () => {
			process.env.PANEL_PORT = '5000';
			process.env.FXSERVER_EXECUTABLE = './FXServer';
			const config = ConfigManager.getInstance();

			const allValues = config.getAllValues(false);
			expect(allValues.webServerPort).toBe(5000);
			expect(allValues.executablePath).toBe('./FXServer');
			expect(mockAll).not.toHaveBeenCalled();
		});

		it('merges and enforces systemValue priority over database settings', () => {
			process.env.PANEL_PORT = '8080';
			mockAll.mockReturnValue([
				// Try to override a system value
				{ key: 'webServerPort', value: 9999 },
				{ key: 'customVariable', value: 'hello-world' },
				{ key: 'onesync', value: 'off' },
			]);

			const config = ConfigManager.getInstance();
			const allValues = config.getAllValues(true);

			expect(mockAll).toHaveBeenCalled();
			expect(allValues.customVariable).toBe('hello-world');
			expect(allValues.onesync).toBe('off');
			expect(allValues.webServerPort).toBe(8080);
		});
	});

	describe('validateExecutablePath()', () => {
		it('auto-detects Windows FXServer.exe inside a valid directory', async () => {
			setPlatform('win32');
			const dirPath = path.join(process.cwd(), 'fxserver-folder');
			const exePath = path.join(dirPath, 'FXServer.exe');

			fileSystem.set(dirPath, 'dir');
			fileSystem.set(exePath, 'file');

			const config = ConfigManager.getInstance();
			const res = await config.validateExecutablePath(dirPath);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(exePath);
		});

		it('auto-detects Linux fxserver inside a valid directory', async () => {
			setPlatform('linux');
			const dirPath = path.join(process.cwd(), 'fxserver-folder');
			const exePath = path.join(dirPath, 'fxserver');

			fileSystem.set(dirPath, 'dir');
			fileSystem.set(exePath, 'file');

			const config = ConfigManager.getInstance();
			const res = await config.validateExecutablePath(dirPath);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(exePath);
		});

		it('validates a direct file path (Case-Insensitive on Windows)', async () => {
			setPlatform('win32');
			const exePath = path.join(process.cwd(), 'fXseRver.eXe');
			fileSystem.set(exePath, 'file');

			const config = ConfigManager.getInstance();
			const res = await config.validateExecutablePath(exePath);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(exePath);
		});

		it('rejects invalid executables', async () => {
			setPlatform('win32');
			const badExePath = path.join(process.cwd(), 'random.exe');
			fileSystem.set(badExePath, 'file');

			const config = ConfigManager.getInstance();
			const res = await config.validateExecutablePath(badExePath);
			expect(res.valid).toBe(false);
			expect(res.path).toBe(badExePath);
		});

		it('handles missing paths gracefully', async () => {
			const config = ConfigManager.getInstance();
			const res = await config.validateExecutablePath('invalid/path');
			expect(res.valid).toBe(false);
		});
	});

	describe('validateDataPath()', () => {
		it('validates an existing directory', async () => {
			const dataPath = path.join(process.cwd(), 'server-data');
			fileSystem.set(dataPath, 'dir');

			const config = ConfigManager.getInstance();
			const res = await config.validateDataPath(dataPath);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(dataPath);
		});

		it('rejects if the path is a file, not a directory', async () => {
			const dataPath = path.join(process.cwd(), 'server-data');
			fileSystem.set(dataPath, 'file');

			const config = ConfigManager.getInstance();
			const res = await config.validateDataPath(dataPath);
			expect(res.valid).toBe(false);
		});

		it('resolves relative paths to cwd', async () => {
			const relativePath = 'my-data';
			const expectedAbsPath = path.join(process.cwd(), relativePath);
			fileSystem.set(expectedAbsPath, 'dir');

			const config = ConfigManager.getInstance();
			const res = await config.validateDataPath(relativePath);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(expectedAbsPath);
		});
	});

	describe('validateConfigPath()', () => {
		it('validates an absolute config path', async () => {
			const cfgPath = path.resolve('/absolute/path/server.cfg');
			fileSystem.set(cfgPath, 'file');

			const config = ConfigManager.getInstance();
			const res = await config.validateConfigPath(cfgPath);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(cfgPath);
		});

		it('uses providedDataPath for relative config files', async () => {
			const providedDataPath = path.resolve('/custom/data/path');
			const cfgName = 'server.cfg';
			const expectedAbsPath = path.join(providedDataPath, cfgName);

			fileSystem.set(expectedAbsPath, 'file');

			const config = ConfigManager.getInstance();
			const res = await config.validateConfigPath(cfgName, providedDataPath);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(expectedAbsPath);
		});

		it('falls back to config manager values if no data path is provided', async () => {
			const defaultDataPath = path.resolve('/default/data/path');
			const cfgName = 'server.cfg';
			const expectedAbsPath = path.join(defaultDataPath, cfgName);

			const config = ConfigManager.getInstance();
			spyOn(config, 'getFxServerValues').mockReturnValue({
				serverDataPath: defaultDataPath,
				serverConfigFile: cfgName,
			} as any);

			fileSystem.set(expectedAbsPath, 'file');

			const res = await config.validateConfigPath(cfgName);
			expect(res.valid).toBe(true);
			expect(res.path).toBe(expectedAbsPath);
		});

		it('fails if the config path is a directory', async () => {
			const cfgName = 'server.cfg';
			const expectedAbsPath = path.join(process.cwd(), cfgName);

			const config = ConfigManager.getInstance();
			spyOn(config, 'getFxServerValues').mockReturnValue({
				serverDataPath: process.cwd(),
			} as any);

			fileSystem.set(expectedAbsPath, 'dir');

			const res = await config.validateConfigPath(cfgName);
			expect(res.valid).toBe(false);
		});
	});

	describe('checkFXServerPaths() (Integration)', () => {
		it('returns fully valid when all paths are correct', async () => {
			setPlatform('linux');
			const inputExe = 'server-bin';
			const inputData = 'server-data';

			const expectedExe = path.join(process.cwd(), inputExe, 'fxserver');
			const expectedData = path.join(process.cwd(), inputData);
			const expectedCfg = path.join(expectedData, 'server.cfg');

			fileSystem.set(path.join(process.cwd(), inputExe), 'dir');
			fileSystem.set(expectedExe, 'file');
			fileSystem.set(expectedData, 'dir');
			fileSystem.set(expectedCfg, 'file');

			const config = ConfigManager.getInstance();
			spyOn(config, 'getFxServerValues').mockReturnValue({
				serverConfigFile: 'server.cfg',
			} as any);

			const res = await config.checkFXServerPaths(inputExe, inputData);

			expect(res.exists.executable).toBe(true);
			expect(res.exists.serverdata).toBe(true);
			expect(res.exists.cfg).toBe(true);

			expect(res.files.executable).toBe(expectedExe);
			expect(res.files.serverdata).toBe(expectedData);
			expect(res.files.cfg).toBe(expectedCfg);
		});

		it('accurately reports partial failures', async () => {
			setPlatform('win32');
			const inputExe = 'FXServer.exe';
			const inputData = 'server-data';

			const expectedExe = path.join(process.cwd(), inputExe);

			fileSystem.set(expectedExe, 'file');

			const config = ConfigManager.getInstance();
			spyOn(config, 'getFxServerValues').mockReturnValue({
				serverConfigFile: 'server.cfg',
			} as any);

			const res = await config.checkFXServerPaths(inputExe, inputData);

			expect(res.exists.executable).toBe(true);
			expect(res.exists.serverdata).toBe(false);
			expect(res.exists.cfg).toBe(false);
		});
	});
});
