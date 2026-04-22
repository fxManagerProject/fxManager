import EventEmitter from "events";
import { loadConfig } from "../common/config";
import { EventNames } from "@fxmanager/shared/constants";
import { type ProcessOutputLine, type ProcessState, type ServerState } from "@fxmanager/shared/types";
import { wsManager } from "./ws.manager";
import { LogBuffer } from "./buffer.manager";

export class ProcessManager {
  private state: ServerState = { status: 'stopped', startedAt: null };
	private proc: ReturnType<typeof Bun.spawn> | null = null;
	private buffer = new LogBuffer<ProcessOutputLine>();

	constructor() {}

	// region process methods
	async start() {
    const config = loadConfig();
    this.setState('starting');

		const args: string[] = [
      '+exec', config.configFile,
      '+set', 'onesync', 'on',
      '+set', 'resource-api-token', config.resourceApiToken,
      '+set', 'api-port', `${config.webServerPort}`,
      // Check if this actually works, would be neat to be able to hide it in console or have it read only
      '+add_convar_permission', 'fxManager', 'read', 'resource-api-token',
      '+add_convar_permission', 'fxManager', 'read', 'api-port',
    ];

		console.log(`[core] Starting fxServer`);

    this.injectConsoleLine({
      payload: {
        line: '\x1b[1m\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
              '\x1b[1m\x1b[32m  🚀 fxManager is starting your server...      \x1b[0m\n' +
              '\x1b[1m\x1b[32m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
        ts: Date.now(),
        source: 'stdout',
      } satisfies ProcessOutputLine
    });

    try {
      this.proc = Bun.spawn([config.executable, ...args], {
        cwd: config.serverDataPath,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      });

    	this.setState('running');

      this.pipeOutput(this.proc.stdout as ReadableStream<Uint8Array<ArrayBuffer>>, 'stdout');
      this.pipeOutput(this.proc.stderr as ReadableStream<Uint8Array<ArrayBuffer>>, 'stderr');

      // this.proc.exited.then((code) => this.onExit(code));
			
			return true;
		} catch (err) {
			console.error(`[core] Failed to start fxServer`, err);
			return false;
		}
	}

	async stop() {
		if (this.state.status !== 'running' || !this.proc) return false;

		console.log(`[core] Stopping fxServer`);
    this.setState('stopping');

    this.injectConsoleLine({
      payload: {
        line: '\n' +
          '\x1b[1m\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
          '\x1b[1m\x1b[33m  🛑 fxManager is stopping the server...       \x1b[0m\n' +
          '\x1b[1m\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
        ts: Date.now(),
        source: 'stdout',
      } satisfies ProcessOutputLine
    });

		this.proc.kill();
    await this.proc.exited;
		this.proc = null;

		console.log(`[core] fxServer has stopped`);
    this.setState('stopped');

    this.injectConsoleLine({
      payload: {
        line: '\n' +
          '\x1b[2m\x1b[37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n' +
          '\x1b[2m\x1b[37m  ⚪ fxServer has been stopped.                 \x1b[0m\n' +
          '\x1b[2m\x1b[37m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m\n\n',
        ts: Date.now(),
        source: 'stdout',
      } satisfies ProcessOutputLine
    });

		return true;
	}

  async restart() {
    if (this.state.status === 'running') await this.stop();
    await this.start();

		return true;
  }

	sendCommand(command: string): void {
    // other possible option ?
    // if (this.state.status !== 'running' || !this.proc) throw new Error('Server stdin not available');
    // this.proc.send(command + '\n');
    const stdin = this.proc?.stdin;
    if (!stdin || typeof stdin === 'number') throw new Error('Server stdin not available');
    stdin.write(command + '\n');
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
    let { payload, process = "fxManager", value, noPrint, color = "\x1b[38;5;208m" } = params;

    if (!payload) {
      const paddedProcess = process.slice(0, 20).padStart(20, " ");
      const isAnsi = color && /^\x1b\[[0-9;]*m$/.test(color);

      let ansiColor: string;
      if (isAnsi) {
        ansiColor = color;
      } else {
        ansiColor = "\x1b[38;5;208m";
      }

      payload = {
        line: `${ansiColor}[${paddedProcess}] ${value}\x1b[0m`,
        ts: Date.now(),
        source: 'stdout',
      } satisfies ProcessOutputLine;
    }

    if(!noPrint) {
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
		const startedAt = status === 'starting'
			? new Date() 
			: status === 'stopped'
				? null 
				: this.state.startedAt;

		const newState = { status, startedAt } satisfies ServerState;

		this.state = newState;
		wsManager.broadcast({
			channel: 'server_state',
			event: 'status_changed',
			data: newState,
		});
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

	/* ToDo: implement onExit checks to clean up */
  private async onExit(code: number | null) {}
}
