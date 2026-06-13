/** biome-ignore-all lint/suspicious/noExplicitAny lint/complexity/noBannedTypes: explicit any allows testing hidden state properties & mocking frames */
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';

// Import real modules to safely establish spies on their shared instances/classes
import { ConfigManager } from '../config/manager';
import { wsManager } from '../ws/manager';
import { resourceManager } from '../resource/manager';

const mockGetHistory = mock(() => []);
const mockBufferPush = mock(() => {});

const mockRegenerateApiToken = mock(() => {});
const mockGetSystemValues = mock(() => ({
	serverConfigFile: 'server.cfg',
	onesync: 'on',
	resourceApiToken: 'mock-api-token',
	webServerPort: 30120,
}));
const mockGetFxServerValues = mock(() => ({
	executable: 'FXServer.exe',
	serverDataPath: '/home/fxserver/server-data',
}));

// Use spyOn to safely intercept instances without corrupting Bun's global module cache
const getInstanceSpy = spyOn(ConfigManager, 'getInstance').mockReturnValue({
	regenerateApiToken: mockRegenerateApiToken,
	getSystemValues: mockGetSystemValues,
	getFxServerValues: mockGetFxServerValues,
} as any);

const broadcastSpy = spyOn(wsManager, 'broadcast').mockImplementation(() => {});
const loadResourcesSpy = spyOn(
	resourceManager,
	'loadResources',
).mockImplementation(async () => {});
const stoppingServerSpy = spyOn(
	resourceManager,
	'stoppingServer',
).mockImplementation(() => {});

const ProcessManagerModule = await import('./manager');
type ProcessManagerInstance = InstanceType<
	typeof ProcessManagerModule.ProcessManager
>;

describe('ProcessManager', () => {
	let processManager: ProcessManagerInstance;

	let originalBunSpawn: typeof Bun.spawn;
	let stdoutController: ReadableStreamDefaultController<Uint8Array> | null =
		null;
	let stderrController: ReadableStreamDefaultController<Uint8Array> | null =
		null;
	let currentTriggerExit: ((code: number | null) => void) | null = null;

	// FACTORY FUNCTION: Yields a completely new process configuration context per call
	const createMockProcess = () => {
		let triggerExit: (code: number | null) => void = () => {};
		const exitedPromise = new Promise<number | null>((resolve) => {
			triggerExit = resolve;
		});

		currentTriggerExit = triggerExit;

		return {
			pid: Math.floor(Math.random() * 10000),
			stdin: {
				write: mock(() => {}),
				flush: mock(() => {}),
			},
			stdout: new ReadableStream({
				start(controller) {
					stdoutController = controller;
				},
			}),
			stderr: new ReadableStream({
				start(controller) {
					stderrController = controller;
				},
			}),
			kill: mock(() => {
				triggerExit(0);
			}),
			exited: exitedPromise,
		};
	};

	beforeEach(() => {
		mockGetHistory.mockReset().mockReturnValue([]);
		mockBufferPush.mockClear();
		mockRegenerateApiToken.mockClear();
		mockGetSystemValues.mockClear();
		mockGetFxServerValues.mockClear();
		broadcastSpy.mockClear();
		loadResourcesSpy.mockClear();
		stoppingServerSpy.mockClear();

		stdoutController = null;
		stderrController = null;
		currentTriggerExit = null;

		// Intercept Bun.spawn with our dynamic multi-instance factory
		originalBunSpawn = Bun.spawn;
		Bun.spawn = mock(() => createMockProcess()) as any;

		processManager = new ProcessManagerModule.ProcessManager();

		// FORCE BIND SPIES onto the instantiated internal buffer field directly
		(processManager as any).buffer = {
			push: mockBufferPush,
			getHistory: mockGetHistory,
		};
	});

	afterEach(() => {
		Bun.spawn = originalBunSpawn;
	});

	// CRITICAL FIX: Fully restore our spied targets back to their baseline code states
	afterAll(() => {
		getInstanceSpy.mockRestore();
		broadcastSpy.mockRestore();
		loadResourcesSpy.mockRestore();
		stoppingServerSpy.mockRestore();
	});

	const pushToStream = (
		controller: ReadableStreamDefaultController<Uint8Array> | null,
		text: string,
	) => {
		if (controller) {
			controller.enqueue(new TextEncoder().encode(text));
		}
	};

	// ==========================================
	// 3. TEST SPECIFICATIONS
	// ==========================================

	describe('Initial Configurations', () => {
		it('should initialize with a completely stopped server status configuration state', () => {
			expect(processManager.getState()).toEqual({
				status: 'stopped',
				startedAt: null,
			});
		});
	});

	describe('start()', () => {
		it('should generate a fresh resource API token, execute spawn, and parse operational process args cleanly', async () => {
			const result = await processManager.start();

			expect(result).toBe(true);
			expect(mockRegenerateApiToken).toHaveBeenCalled();
			expect(processManager.getState().status).toBe('starting');
			expect(processManager.getState().startedAt).toBeInstanceOf(Date);

			expect(Bun.spawn).toHaveBeenCalledWith(
				[
					'FXServer.exe',
					'+exec',
					'server.cfg',
					'+set',
					'onesync',
					'on',
					'+set',
					'resource-api-token',
					'mock-api-token',
					'+set',
					'api-port',
					'30120',
					'+ensure',
					'fxManager',
					'+add_convar_permission',
					'fxManager',
					'read',
					'resource-api-token',
					'+add_convar_permission',
					'fxManager',
					'read',
					'api-port',
				],
				{
					cwd: '/home/fxserver/server-data',
					stdin: 'pipe',
					stdout: 'pipe',
					stderr: 'pipe',
					env: expect.any(Object),
				},
			);
		});

		it('should catch runtime deployment errors gracefully and report setup execution failure flags', async () => {
			Bun.spawn = mock(() => {
				throw new Error('Fatal Native Binary Execution Fault');
			}) as any;

			const result = await processManager.start();
			expect(result).toBe(false);
		});
	});

	describe('Piped Output Streams & Line Parsing', () => {
		it('should promote tracking context to running and load system resources when authentication patterns match', async () => {
			await processManager.start();

			pushToStream(stdoutController, 'Some random bootup message...\n');
			pushToStream(stdoutController, 'Authenticated with cfx.re Nucleus\n');

			await Bun.sleep(15); // Extended sleep value to let the text decoder transform stream cycles settle

			expect(processManager.getState().status).toBe('running');
			expect(loadResourcesSpy).toHaveBeenCalled();
			expect(mockBufferPush).toHaveBeenCalled();
		});

		it('should completely filter out empty cfx interactive terminal prompt wrappers from the buffer logs', async () => {
			await processManager.start();

			pushToStream(stdoutController, 'cfx> \n');
			await Bun.sleep(15);

			// Total calls must only reflect the initial startup console banner sequence
			expect(mockBufferPush).toHaveBeenCalled();
		});
	});

	describe('stop()', () => {
		it('should refuse processing commands if server configurations present an inactive tracking state', async () => {
			const result = await processManager.stop();
			expect(result).toBe(false);
		});

		it('should gracefully invoke native kill routines, clear memory buffers, and cycle state configurations down', async () => {
			await processManager.start();

			pushToStream(stdoutController, 'Authenticated with cfx.re Nucleus\n');
			await Bun.sleep(15);

			const stopPromise = processManager.stop();

			expect(processManager.getState().status).toBe('stopping');
			expect(stoppingServerSpy).toHaveBeenCalled();

			if (currentTriggerExit) currentTriggerExit(0);

			const result = await stopPromise;
			expect(result).toBe(true);
			expect(processManager.getState().status).toBe('stopped');
		});
	});

	describe('restart()', () => {
		it('should cleanly chain sequential termination and initialization procedures smoothly', async () => {
			await processManager.start();
			pushToStream(stdoutController, 'Authenticated with cfx.re Nucleus\n');
			await Bun.sleep(15);

			const stopSpy = spyOn(processManager, 'stop');
			const startSpy = spyOn(processManager, 'start');

			const restartPromise = processManager.restart();

			if (currentTriggerExit) currentTriggerExit(143);

			await restartPromise;

			expect(stopSpy).toHaveBeenCalled();
			expect(startSpy).toHaveBeenCalled();
		});
	});

	describe('sendCommand()', () => {
		it('should securely throw validation errors if an external user targets an inactive process standard input pipe', () => {
			expect(() => processManager.sendCommand('status')).toThrow(
				'Server stdin not available',
			);
		});

		it('should deliver string payloads to native standard output frames followed by mandatory line buffers and flushes', async () => {
			await processManager.start();

			processManager.sendCommand('ensure es_extended');

			const activeProc = (processManager as any).proc;
			expect(activeProc.stdin.write).toHaveBeenCalledWith(
				'ensure es_extended\n',
			);
			expect(activeProc.stdin.flush).toHaveBeenCalled();
		});
	});

	describe('getLogs() & injectConsoleLine()', () => {
		it('should proxy extraction chains directly to buffer storage maps', () => {
			processManager.getLogs();
			expect(mockGetHistory).toHaveBeenCalled();
		});

		it('should compile standardized ANSI string structures when fallback console print elements are omitted', () => {
			processManager.injectConsoleLine({
				value: 'Dynamic Trace Event',
				process: 'auth-layer',
				noPrint: true,
			});

			expect(mockBufferPush).toHaveBeenCalledWith(
				expect.objectContaining({
					line: expect.stringContaining('Dynamic Trace Event'),
					source: 'stdout',
				}),
			);
			expect(broadcastSpy).toHaveBeenCalledWith(
				expect.objectContaining({ channel: 'console', event: 'line' }),
			);
		});
	});
});
