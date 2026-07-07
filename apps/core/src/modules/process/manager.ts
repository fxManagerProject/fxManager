import type {
	ApiResponse,
	ProcessOutputLine,
	ProcessState,
	ServerState,
} from '@fxmanager/shared/types';
import { getServerNetEndpoint } from '../../common/fxserver-endpoint';
import {
	buildFxServerCommand,
	resolveMuslLoader,
} from '../../common/fxserver-launch';
import { parseFxServerBuild } from '../../common/fxserver-version';
import { LogBuffer } from '../buffer/manager';
import { ConfigManager } from '../config/manager';
import { wsManager } from '../ws/manager';
import { resourceManager } from '../resource/manager';
import { aceSync } from '../ace/manager';
import { disconnectManager } from '../disconnect/manager';
import { sessionManager } from '../session/manager';
import { gameManager } from '../game/manager';
import { txAdminCompat } from '../txadmin/compat';
import { repo } from '@fxmanager/database';

const STARTUP_STALL_MS = 90_000;
const KILL_GRACE_MS = 5_000;
const SHUTDOWN_EVENT_GRACE_MS = 10_000;
const CONSOLE_FLUSH_MS = 50;

type ShutdownOpts = { author?: string; message?: string; forceCrash?: boolean };
type RawOutputLine = Omit<ProcessOutputLine, 'seq'>;

export class ProcessManager {
	private state: ServerState = {
		status: 'stopped',
		startedAt: null,
		version: null,
	};
	private proc: ReturnType<typeof Bun.spawn> | null = null;
	private buffer = new LogBuffer<ProcessOutputLine>();
	private config = ConfigManager.getInstance();
	private startupTimer: ReturnType<typeof setTimeout> | null = null;
	private lineSeq = 0;
	private pendingLines: ProcessOutputLine[] = [];
	private flushTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly startupStallMs: number;
	private readonly shutdownGraceMs: number;

	constructor(opts?: { startupStallMs?: number; shutdownGraceMs?: number }) {
		this.startupStallMs = opts?.startupStallMs ?? STARTUP_STALL_MS;
		this.shutdownGraceMs = opts?.shutdownGraceMs ?? SHUTDOWN_EVENT_GRACE_MS;
	}

	// region process methods
	async start() {
		if (this.state.status !== 'stopped' && this.state.status !== 'crashed') {
			console.warn(
				`[core] start() ignored, server is already '${this.state.status}'`,
			);
			return false;
		}

		this.config.regenerateApiToken();
		const systemValues = this.config.getSystemValues();
		const fxServerValues = this.config.getFxServerValues(true);
		const config = { ...systemValues, ...fxServerValues };

		this.setState('starting');

		// biome-ignore format: the array should not be formatted
		const args: string[] = [
			'+exec',                      config.serverConfigFile,
			'+set', 'onesync',            config.onesync,
			'+set', 'resource-api-token', config.resourceApiToken,
			'+set', 'api-port',           `${config.webServerPort}`,

			'+ensure', 'fxManager',

			// Check if this actually works, would be neat to be able to hide it in console or have it read only
			'+add_convar_permission', 'fxManager', 'read', 'resource-api-token',
			'+add_convar_permission', 'fxManager', 'read', 'api-port',
		];

		const configuredArgs =
			repo.settings.get('fxserver.startupArguments')?.split(' ') ?? [];
		args.push(...configuredArgs);

		console.log(`[core] Starting fxServer`);

		this.injectConsoleLine({
			payload: {
				line:
					'\x1b[1m\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
					'\x1b[1m\x1b[32m  🚀 fxManager is starting your server...      \x1b[0m\n' +
					'\x1b[1m\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
				ts: Date.now(),
				source: 'stdout',
			} satisfies RawOutputLine,
		});

		try {
			const muslLoader = resolveMuslLoader(
				config.executablePath,
				config.platform,
			);
			const command = buildFxServerCommand(
				config.executablePath,
				args,
				muslLoader,
			);

			this.proc = Bun.spawn(command, {
				cwd: config.serverDataPath,
				stdin: 'pipe',
				stdout: 'pipe',
				stderr: 'pipe',
				env: { ...process.env },
			});

			this.pipeOutput(
				this.proc.stdout as ReadableStream<Uint8Array<ArrayBuffer>>,
				'stdout',
			);
			this.pipeOutput(
				this.proc.stderr as ReadableStream<Uint8Array<ArrayBuffer>>,
				'stderr',
			);

			this.proc.exited.then((code) => this.onExit(code));
			this.armStartupWatchdog();

			return true;
		} catch (err) {
			console.error(`[core] Failed to start fxServer`, err);
			this.clearStartupWatchdog();
			this.proc = null;
			this.setState('crashed');
			return false;
		}
	}

	async stop(opts?: ShutdownOpts) {
		if (
			!this.proc ||
			this.state.status === 'stopping' ||
			this.state.status === 'stopped'
		)
			return false;

		const proc = this.proc;
		const wasRunning = this.state.status === 'running';
		const isForceCrash = opts?.forceCrash === true;

		if (isForceCrash) {
			console.log(`[core] Force crashing fxServer due to unmet requirements`);
			this.clearStartupWatchdog();
		} else {
			console.log(`[core] Stopping fxServer`);
			this.setState('stopping');
			this.clearStartupWatchdog();

			this.injectConsoleLine({
				payload: {
					line:
						'\n' +
						'\x1b[1m\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
						'\x1b[1m\x1b[33m  🛑 fxManager is stopping the server...       \x1b[0m\n' +
						'\x1b[1m\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
					ts: Date.now(),
					source: 'stdout',
				} satisfies RawOutputLine,
			});

			if (wasRunning) await this.announceShutdown(opts);
		}

		await this.terminate(proc);

		console.log(`[core] fxServer has stopped`);

		this.injectConsoleLine({
			payload: {
				line: isForceCrash
					? '\n' +
						'\x1b[2m\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
						'\x1b[2m\x1b[31m  ⚫ fxServer process was forcefully terminated. \x1b[0m\n' +
						'\x1b[2m\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n'
					: '\n' +
						'\x1b[2m\x1b[37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
						'\x1b[2m\x1b[37m  ⚪ fxServer has been stopped.                 \x1b[0m\n' +
						'\x1b[2m\x1b[37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
				ts: Date.now(),
				source: isForceCrash ? 'stderr' : 'stdout',
			} satisfies RawOutputLine,
		});

		return true;
	}

	async restart(opts?: ShutdownOpts) {
		if (this.state.status === 'running' || this.state.status === 'starting')
			await this.stop(opts);
		await this.start();

		return true;
	}

	private async announceShutdown(opts?: ShutdownOpts): Promise<void> {
		const delay = this.shutdownGraceMs;

		await txAdminCompat.emit('serverShuttingDown', {
			delay,
			author: opts?.author ?? 'System',
			message: opts?.message ?? 'Server is shutting down.',
		});

		if (delay > 0) {
			await new Promise<void>((resolve) => setTimeout(resolve, delay));
		}
	}

	sendCommand(command: string): void {
		const stdin = this.proc?.stdin;
		if (!stdin || typeof stdin === 'number')
			throw new Error('Server stdin not available');
		stdin.write(`${command}\n`);
		stdin.flush();
	}

	getLogs() {
		return this.buffer.getHistory();
	}

	getState() {
		return this.state;
	}

	injectConsoleLine(params: {
		payload?: RawOutputLine;
		process?: string;
		value?: string;
		color?: string;
		noPrint?: boolean;
	}) {
		let {
			payload,
			process = 'fxManager',
			value,
			noPrint,
			color = '\x1b[38;5;208m',
		} = params;

		if (!payload) {
			const paddedProcess = process.slice(0, 20).padStart(20, ' ');
			// biome-ignore lint: needed to check if the string colour is an ansi code
			const isAnsi = color && /^\x1b\[[0-9;]*m$/.test(color);

			let ansiColor: string;
			if (isAnsi) {
				ansiColor = color;
			} else {
				ansiColor = '\x1b[38;5;208m';
			}

			payload = {
				line: `${ansiColor}[${paddedProcess}] ${value}\x1b[0m`,
				ts: Date.now(),
				source: 'stdout',
			} satisfies RawOutputLine;
		}

		if (!noPrint) {
			console.log(payload.line);
		}

		this.emitLine(payload);
	}

	private emitLine(raw: RawOutputLine) {
		const line = { ...raw, seq: this.lineSeq++ } satisfies ProcessOutputLine;
		this.buffer.push(line);
		this.pendingLines.push(line);
		this.scheduleFlush();
	}

	private scheduleFlush() {
		if (this.flushTimer) return;
		this.flushLines();
		this.flushTimer = setTimeout(() => {
			this.flushTimer = null;
			if (this.pendingLines.length > 0) this.scheduleFlush();
		}, CONSOLE_FLUSH_MS);
		this.flushTimer.unref?.();
	}

	private flushLines() {
		if (this.pendingLines.length === 0) return;
		const batch = this.pendingLines;
		this.pendingLines = [];
		wsManager.broadcast({
			channel: 'console',
			event: 'lines',
			data: batch,
		});
	}

	// region private methods
	private setState(status: ProcessState) {
		const startedAt =
			status === 'starting'
				? new Date()
				: status === 'stopped'
					? null
					: this.state.startedAt;

		const version = status === 'running' ? this.state.version : null;
		const newState = { status, startedAt, version } satisfies ServerState;

		this.state = newState;
		wsManager.broadcast({
			channel: 'server_state',
			event: 'status_changed',
			data: newState,
		});

		if (status === 'running') {
			resourceManager.loadResources();
			gameManager.resetPlayerlist();
			aceSync.apply(this);
			const session = sessionManager.openSession();
			disconnectManager.onSessionOpen(session);
			void this.fetchServerVersion();
		} else if (status === 'crashed' || status === 'stopping') {
			resourceManager.stoppingServer();
		}

		if (status === 'stopped' || status === 'crashed') {
			gameManager.resetPlayerlist();
			const closed = sessionManager.closeSession(
				status === 'crashed' ? 'crashed' : null,
			);
			disconnectManager.onSessionClose(closed);
		}
	}

	private async fetchServerVersion(): Promise<void> {
		try {
			const { resourceApiToken } = this.config.getSystemValues();
			const endpoint = await getServerNetEndpoint();
			const response = await fetch(
				`http://${endpoint}/fxManager/server/version`,
				{
					method: 'GET',
					headers: {
						Application: 'json/application',
						'x-resource-token': resourceApiToken,
					},
				},
			);

			if (!response.ok) {
				throw new Error(
					`Server responded with ${response.status}: ${response.statusText}`,
				);
			}

			const result = (await response.json()) as ApiResponse<string>;
			if (!result.success) {
				console.error(
					`[core] Failed to read fxServer version: ${result.error}`,
				);
				return;
			}

			const build = parseFxServerBuild(result.data);
			if (build && this.state.status === 'running') {
				this.state = { ...this.state, version: build };
				wsManager.broadcast({
					channel: 'server_state',
					event: 'status_changed',
					data: this.state,
				});
			}
		} catch (err) {
			console.error(
				`[core] Failed to fetch fxServer version: ${(err as Error).message}`,
			);
		}
	}

	private armStartupWatchdog() {
		this.clearStartupWatchdog();
		this.startupTimer = setTimeout(() => {
			void this.onStartupStalled();
		}, this.startupStallMs);
		this.startupTimer.unref?.();
	}

	private clearStartupWatchdog() {
		if (this.startupTimer) {
			clearTimeout(this.startupTimer);
			this.startupTimer = null;
		}
	}

	private async onStartupStalled() {
		if (this.state.status !== 'starting' || !this.proc) return;

		console.warn(
			`[core] fxServer produced no output for ${this.startupStallMs}ms while starting, terminating it`,
		);
		this.injectConsoleLine({
			process: 'fxManager',
			value:
				'Server stalled while starting (no output — possible license/auth issue). Stopping it so you can try again.',
			color: '\x1b[38;5;196m',
		});

		await this.terminate(this.proc);
	}

	private async terminate(proc: ReturnType<typeof Bun.spawn>) {
		proc.kill();

		let escalation: ReturnType<typeof setTimeout> | null = setTimeout(() => {
			try {
				proc.kill('SIGKILL');
			} catch {}
		}, KILL_GRACE_MS);
		escalation.unref?.();

		try {
			await proc.exited;
		} finally {
			if (escalation) {
				clearTimeout(escalation);
				escalation = null;
			}
		}
	}

	private createLineBreakTransformer() {
		let buffer = '';
		return new TransformStream<string, string>({
			transform(chunk, controller) {
				buffer += chunk;
				const lines = buffer.split(/\r?\n/);
				buffer = lines.pop() || '';
				for (const line of lines) controller.enqueue(line);
			},
			flush(controller) {
				if (buffer) controller.enqueue(buffer);
			},
		});
	}

	/* ToDo: consider logging outputs to a logs directory ? */
	private async pipeOutput(
		stream: ReadableStream<Uint8Array> | undefined,
		source: 'stdout' | 'stderr',
	) {
		if (!stream) return;

		// ToDo: check for better approach, ts error on TextDecoderStream()
		const lineStream = stream
			// @ts-ignore
			.pipeThrough(new TextDecoderStream())
			.pipeThrough(this.createLineBreakTransformer());

		const reader = lineStream.getReader();

		try {
			while (true) {
				const { done, value } = await reader.read();
				let forceCrash = false;
				if (done) break;

				// skip the fxserver empty prompt
				if (value.trim() === 'cfx>') continue;

				const event = {
					line: value,
					source,
					ts: Date.now(),
				} satisfies RawOutputLine;

				if (this.state.status === 'starting') {
					if (value.includes('Authenticated with cfx.re Nucleus')) {
						this.clearStartupWatchdog();
						this.setState('running');
					} else {
						this.armStartupWatchdog();
					}

					if (value.includes("Couldn't find resource fxManager")) {
						this.injectConsoleLine({
							process: 'fxManager',
							value: 'The server can not run without the fxManager resource.',
							color: '\x1b[31m',
						});
						forceCrash = true;
					}
				}

				console.log(value);

				this.emitLine(event);

				if (forceCrash) {
					this.stop({ forceCrash: true, message: 'The panel can not function properly without the fxManager resource.' });
					return;
				}
			}
		} catch (err) {
			console.error(`Stream error:`, err);
		}
	}

	private async onExit(code: number | null) {
		this.clearStartupWatchdog();
		const previous = this.state.status;
		this.proc = null;

		if (previous === 'stopping' || previous === 'stopped') {
			this.setState('stopped');
			return;
		}

		if (previous === 'starting') {
			console.warn(`[core] fxServer exited during startup with code ${code}`);
			this.setState('crashed');
			return;
		}

		const graceful = code === 0 || code === 143 || code === null;
		if (graceful) {
			this.setState('stopped');
		} else {
			console.warn(`[core] fxServer process exited with code ${code}`);
			this.setState('crashed');
		}
	}
}

export const processManager = new ProcessManager();
