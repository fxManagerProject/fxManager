import type {
	ApiResponse,
	ProcessOutputLine,
	ProcessState,
	ServerState,
} from '@fxmanager/shared/types';
import { getServerNetEndpoint } from '../../common/fxserver-endpoint';
import { parseFxServerBuild } from '../../common/fxserver-version';
import { LogBuffer } from '../buffer/manager';
import { ConfigManager } from '../config/manager';
import { wsManager } from '../ws/manager';
import { resourceManager } from '../resource/manager';

const STARTUP_STALL_MS = 90_000;
const KILL_GRACE_MS = 5_000;

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
	private readonly startupStallMs: number;

	constructor(opts?: { startupStallMs?: number }) {
		this.startupStallMs = opts?.startupStallMs ?? STARTUP_STALL_MS;
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

		console.log(`[core] Starting fxServer`);

		this.injectConsoleLine({
			payload: {
				line:
					'\x1b[1m\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
					'\x1b[1m\x1b[32m  🚀 fxManager is starting your server...      \x1b[0m\n' +
					'\x1b[1m\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
				ts: Date.now(),
				source: 'stdout',
			} satisfies ProcessOutputLine,
		});

		try {
			this.proc = Bun.spawn([config.executablePath, ...args], {
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

	async stop() {
		if (
			!this.proc ||
			this.state.status === 'stopping' ||
			this.state.status === 'stopped'
		)
			return false;

		const proc = this.proc;

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
			} satisfies ProcessOutputLine,
		});

		await this.terminate(proc);

		console.log(`[core] fxServer has stopped`);

		this.injectConsoleLine({
			payload: {
				line:
					'\n' +
					'\x1b[2m\x1b[37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
					'\x1b[2m\x1b[37m  ⚪ fxServer has been stopped.                 \x1b[0m\n' +
					'\x1b[2m\x1b[37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
				ts: Date.now(),
				source: 'stdout',
			} satisfies ProcessOutputLine,
		});

		return true;
	}

	async restart() {
		if (this.state.status === 'running' || this.state.status === 'starting')
			await this.stop();
		await this.start();

		return true;
	}

	sendCommand(command: string): void {
		// other possible option ?
		// if (this.state.status !== 'running' || !this.proc) throw new Error('Server stdin not available');
		// this.proc.send(command + '\n');
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
		payload?: ProcessOutputLine;
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
			} satisfies ProcessOutputLine;
		}

		if (!noPrint) {
			console.log(payload.line);
		}

		this.buffer.push(payload);
		wsManager.broadcast({
			channel: 'console',
			event: 'line',
			data: payload,
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
			void this.fetchServerVersion();
		} else if (status === 'crashed' || status === 'stopping') {
			resourceManager.stoppingServer();
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
				if (done) break;

				// skip the fxserver empty prompt
				if (value.trim() === 'cfx>') continue;

				const event = {
					line: value,
					source,
					ts: Date.now(),
				} satisfies ProcessOutputLine;

				if (this.state.status === 'starting') {
					if (value.includes('Authenticated with cfx.re Nucleus')) {
						this.clearStartupWatchdog();
						this.setState('running');
					} else {
						this.armStartupWatchdog();
					}
				}

				console.log(value);

				this.buffer.push(event);
				wsManager.broadcast({
					channel: 'console',
					event: 'line',
					data: event,
				});
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
