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
import { disconnectManager } from '../disconnect/manager';
import { sessionManager } from '../session/manager';
import { gameManager } from '../game/manager';
import { txAdminCompat } from '../txadmin/compat';

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
	executablePath: 'FXServer.exe',
	serverDataPath: '/home/fxserver/server-data',
	serverConfigFile: 'server.cfg',
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
// setState() drives server-session open/close as a side effect; stub the
// session + disconnect managers so the real DB is never touched.
const stubSession = {
	id: 1,
	startedAt: 1000,
	endedAt: null as number | null,
	closeReason: null as string | null,
};
const sessionOpenSpy = spyOn(sessionManager, 'openSession').mockReturnValue(
	stubSession,
);
const sessionCloseSpy = spyOn(sessionManager, 'closeSession').mockReturnValue({
	...stubSession,
	endedAt: 5000,
});
const onSessionOpenSpy = spyOn(
	disconnectManager,
	'onSessionOpen',
).mockImplementation(() => {});
const onSessionCloseSpy = spyOn(
	disconnectManager,
	'onSessionClose',
).mockImplementation(() => {});
const resetPlayerlistSpy = spyOn(
	gameManager,
	'resetPlayerlist',
).mockImplementation(() => {});
const txEmitSpy = spyOn(txAdminCompat, 'emit').mockResolvedValue(undefined);

const ProcessManagerModule = await import('./manager');
type ProcessManagerInstance = InstanceType<
	typeof ProcessManagerModule.ProcessManager
>;

describe('ProcessManager', () => {
	let processManager: ProcessManagerInstance;

	let originalBunSpawn: typeof Bun.spawn;
	let originalGlobalFetch: typeof globalThis.fetch;
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
		sessionOpenSpy.mockClear();
		sessionCloseSpy.mockClear();
		onSessionOpenSpy.mockClear();
		onSessionCloseSpy.mockClear();
		resetPlayerlistSpy.mockClear();
		txEmitSpy.mockClear();

		stdoutController = null;
		stderrController = null;
		currentTriggerExit = null;

		// Intercept Bun.spawn with our dynamic multi-instance factory
		originalBunSpawn = Bun.spawn;
		Bun.spawn = mock(() => createMockProcess()) as any;

		originalGlobalFetch = globalThis.fetch;
		globalThis.fetch = mock(() =>
			Promise.resolve(
				new Response(
					JSON.stringify({
						success: true,
						data: 'FXServer-master SERVER v1.0.0.31725 win32',
					}),
					{ status: 200 },
				),
			),
		) as any;

		processManager = new ProcessManagerModule.ProcessManager({
			shutdownGraceMs: 0,
		});

		// FORCE BIND SPIES onto the instantiated internal buffer field directly
		(processManager as any).buffer = {
			push: mockBufferPush,
			getHistory: mockGetHistory,
		};
	});

	afterEach(() => {
		Bun.spawn = originalBunSpawn;
		globalThis.fetch = originalGlobalFetch;
	});

	// CRITICAL FIX: Fully restore our spied targets back to their baseline code states
	afterAll(() => {
		getInstanceSpy.mockRestore();
		broadcastSpy.mockRestore();
		loadResourcesSpy.mockRestore();
		stoppingServerSpy.mockRestore();
		sessionOpenSpy.mockRestore();
		sessionCloseSpy.mockRestore();
		onSessionOpenSpy.mockRestore();
		onSessionCloseSpy.mockRestore();
		resetPlayerlistSpy.mockRestore();
		txEmitSpy.mockRestore();
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
				version: null,
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

		it('reads, parses, and stores the fxServer artifact build once the server is running', async () => {
			await processManager.start();

			pushToStream(stdoutController, 'Authenticated with cfx.re Nucleus\n');
			await Bun.sleep(15);

			expect(processManager.getState().status).toBe('running');
			expect(processManager.getState().version).toBe('31725');
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

	describe('txAdmin serverShuttingDown compat', () => {
		it('relays serverShuttingDown when stopping a running server, with the grace delay and author', async () => {
			await processManager.start();
			pushToStream(stdoutController, 'Authenticated with cfx.re Nucleus\n');
			await Bun.sleep(15);
			expect(processManager.getState().status).toBe('running');

			const stopPromise = processManager.stop({ author: 'Maximus' });
			if (currentTriggerExit) currentTriggerExit(0);
			await stopPromise;

			expect(txEmitSpy).toHaveBeenCalledWith(
				'serverShuttingDown',
				expect.objectContaining({ delay: 0, author: 'Maximus' }),
			);
		});

		it('defaults the author to System when none is supplied', async () => {
			await processManager.start();
			pushToStream(stdoutController, 'Authenticated with cfx.re Nucleus\n');
			await Bun.sleep(15);

			const stopPromise = processManager.stop();
			if (currentTriggerExit) currentTriggerExit(0);
			await stopPromise;

			expect(txEmitSpy).toHaveBeenCalledWith(
				'serverShuttingDown',
				expect.objectContaining({ author: 'System' }),
			);
		});

		it('does not relay serverShuttingDown when stopping a server still starting', async () => {
			await processManager.start();
			expect(processManager.getState().status).toBe('starting');

			await processManager.stop();

			expect(txEmitSpy).not.toHaveBeenCalled();
		});

		it('relays serverShuttingDown once on the stop leg of a restart', async () => {
			await processManager.start();
			pushToStream(stdoutController, 'Authenticated with cfx.re Nucleus\n');
			await Bun.sleep(15);

			const restartPromise = processManager.restart({ author: 'Maximus' });
			if (currentTriggerExit) currentTriggerExit(143);
			await restartPromise;

			const shutdownCalls = txEmitSpy.mock.calls.filter(
				(call) => call[0] === 'serverShuttingDown',
			);
			expect(shutdownCalls).toHaveLength(1);
		});
	});

	describe('Recovery from failed / hung starts', () => {
		it('marks the server crashed and clears the process when it exits during startup without authenticating', async () => {
			await processManager.start();
			expect(processManager.getState().status).toBe('starting');

			pushToStream(
				stderrController,
				'An error occurred while checking server license key: HTTP 429: Too Many Requests\n',
			);
			if (currentTriggerExit) currentTriggerExit(1);
			await Bun.sleep(15);

			expect(processManager.getState().status).toBe('crashed');
			expect((processManager as any).proc).toBeNull();
		});

		it('lets the operator stop a server that is stuck in starting', async () => {
			await processManager.start();
			expect(processManager.getState().status).toBe('starting');

			const result = await processManager.stop();

			expect(result).toBe(true);
			expect(processManager.getState().status).toBe('stopped');
			expect((processManager as any).proc).toBeNull();
		});

		it('kills a start that goes silent and marks it crashed once the stall window elapses', async () => {
			const watched = new ProcessManagerModule.ProcessManager({
				startupStallMs: 40,
			});
			(watched as any).buffer = {
				push: mockBufferPush,
				getHistory: mockGetHistory,
			};

			await watched.start();
			expect(watched.getState().status).toBe('starting');

			await Bun.sleep(120);

			expect(watched.getState().status).toBe('crashed');
			expect((watched as any).proc).toBeNull();
		});

		it('does not kill a slow start that keeps logging progress past the stall window', async () => {
			const watched = new ProcessManagerModule.ProcessManager({
				startupStallMs: 60,
			});
			(watched as any).buffer = {
				push: mockBufferPush,
				getHistory: mockGetHistory,
			};

			await watched.start();

			// keep emitting boot output with gaps shorter than the stall window,
			// for a total span well beyond it
			for (let i = 0; i < 6; i++) {
				pushToStream(stdoutController, `Started resource sample-${i}\n`);
				await Bun.sleep(30);
			}

			expect(watched.getState().status).toBe('starting');
			expect((watched as any).proc).not.toBeNull();
		});

		it('refuses to start again while already starting, avoiding an orphaned child process', async () => {
			await processManager.start();
			const spawnCallsAfterFirst = (Bun.spawn as any).mock.calls.length;

			const result = await processManager.start();

			expect(result).toBe(false);
			expect((Bun.spawn as any).mock.calls.length).toBe(spawnCallsAfterFirst);
		});

		it('does not get stuck in starting when spawn throws', async () => {
			Bun.spawn = mock(() => {
				throw new Error('Fatal Native Binary Execution Fault');
			}) as any;

			const result = await processManager.start();

			expect(result).toBe(false);
			expect(processManager.getState().status).not.toBe('starting');
			expect((processManager as any).proc).toBeNull();
		});

		it('recovers a server stuck in starting via restart()', async () => {
			await processManager.start();
			expect(processManager.getState().status).toBe('starting');

			const stopSpy = spyOn(processManager, 'stop');
			await processManager.restart();

			expect(stopSpy).toHaveBeenCalled();
			expect(processManager.getState().status).toBe('starting');
			expect((processManager as any).proc).not.toBeNull();
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
					seq: expect.any(Number),
				}),
			);
			expect(broadcastSpy).toHaveBeenCalledWith(
				expect.objectContaining({
					channel: 'console',
					event: 'lines',
					data: expect.arrayContaining([
						expect.objectContaining({
							line: expect.stringContaining('Dynamic Trace Event'),
						}),
					]),
				}),
			);
		});
	});

	describe('server session lifecycle', () => {
		it('opens a session on running and closes it on stopped', () => {
			const manager = new ProcessManagerModule.ProcessManager();
			(manager as any).setState('running');
			expect(sessionOpenSpy).toHaveBeenCalledTimes(1);
			expect(onSessionOpenSpy).toHaveBeenCalledTimes(1);
			(manager as any).setState('stopped');
			expect(sessionCloseSpy).toHaveBeenCalledTimes(1);
			expect(onSessionCloseSpy).toHaveBeenCalledTimes(1);
		});

		it('resets the tracked playerlist on session open and close', () => {
			const manager = new ProcessManagerModule.ProcessManager();
			(manager as any).setState('running');
			expect(resetPlayerlistSpy).toHaveBeenCalledTimes(1);
			(manager as any).setState('crashed');
			expect(resetPlayerlistSpy).toHaveBeenCalledTimes(2);
		});
	});

	describe('Console output batching', () => {
		// stray flush timers from other tests' instances can fire mid-test
		const batchesWithMarker = (marker: string) =>
			broadcastSpy.mock.calls
				.map((call) => call[0] as any)
				.filter(
					(msg) =>
						msg.channel === 'console' &&
						msg.event === 'lines' &&
						msg.data.some((l: any) => l.line.includes(marker)),
				);

		it('broadcasts the first line immediately and coalesces the rest of the burst into one batch', async () => {
			processManager.injectConsoleLine({ value: 'burst-one', noPrint: true });
			processManager.injectConsoleLine({ value: 'burst-two', noPrint: true });
			processManager.injectConsoleLine({ value: 'burst-three', noPrint: true });

			expect(batchesWithMarker('burst-')).toHaveLength(1);
			expect(batchesWithMarker('burst-')[0].data).toHaveLength(1);

			await Bun.sleep(100);

			const batches = batchesWithMarker('burst-');
			expect(batches).toHaveLength(2);
			expect(batches[1].data).toHaveLength(2);
		});

		it('stamps strictly increasing seq values on every emitted line', async () => {
			processManager.injectConsoleLine({ value: 'seq-a', noPrint: true });
			processManager.injectConsoleLine({ value: 'seq-b', noPrint: true });
			processManager.injectConsoleLine({ value: 'seq-c', noPrint: true });
			await Bun.sleep(100);

			const seqs = batchesWithMarker('seq-')
				.flatMap((msg) => msg.data)
				.map((line: any) => line.seq);
			expect(seqs).toEqual([0, 1, 2]);
		});
	});
});
