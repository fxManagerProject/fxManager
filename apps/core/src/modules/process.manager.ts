import EventEmitter from "events";
import { loadConfig } from "../common/config";
import { EventNames } from "@fxmanager/shared/constants";
import { type ProcessState, type ServerState } from "@fxmanager/shared/types";

export class ProcessManager extends EventEmitter {
  private state: ServerState = { status: 'stopped', startedAt: null };
	private proc: ReturnType<typeof Bun.spawn> | null = null;
	/* ToDo: implement log buffer */
	private logs: any[] = [];

	constructor() {
		super();
	}

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

		console.log({ executable: config.executable, cwd: config.serverDataPath, args });

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

		this.proc.kill();
    await this.proc.exited;
		this.proc = null;

		console.log(`[core] fxServer has stopped`);
    this.setState('stopped');

		return true;
	}

  async restart() {
    if (this.state.status === 'running') await this.stop();
    await this.start();

		return true;
  }

	// testing code ? or improve
	// getLogs() {
	// 	return this.logs;
	// }

	// region private methods
	private setState(status: ProcessState) {
		const startedAt = status === 'starting'
			? new Date() 
			: status === 'stopped'
				? null 
				: this.state.startedAt;

		const newState = { status, startedAt } satisfies ServerState;

		this.state = newState;
		this.emit(EventNames.SERVERSTATUS, newState);
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
        };

				console.log(value);

        this.logs.push(event);
        this.emit('console', event);
      }
    } catch (err) {
      console.error(`Stream error:`, err);
    }
  }

	/* ToDo: implement onExit checks to clean up */
  private async onExit(code: number | null) {}
}
