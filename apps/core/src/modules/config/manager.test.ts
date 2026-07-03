/** biome-ignore-all lint/suspicious/noExplicitAny: explicit any allows testing hidden state properties & mocking frames */
import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

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

import { ConfigManager } from './manager';

describe('ConfigManager', () => {
	let originalEnv: typeof process.env;

	beforeEach(() => {
		originalEnv = { ...process.env };

		delete process.env.FXSERVER_EXECUTABLE;
		delete process.env.FXSERVER_DATA_PATH;
		delete process.env.FXSERVER_CFG;
		delete process.env.PANEL_PORT;
		delete process.env.COOKIE_SECRET;

		(ConfigManager as any).instance = null;
	});

	afterEach(() => {
		process.env = originalEnv;
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
});
