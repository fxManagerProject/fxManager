import { EventEmitter } from 'events';
import type { IProcessManager, LogSegment } from '@fxmanager/types';
import { repo } from '@fxmanager/database';
import { loadConfig } from '../config';
import type { ServerState, ServerStatus, ConsoleOutputEvent } from '@fxmanager/types';
import { LogBuffer } from './consoleBuffer';

export class ProcessManager extends EventEmitter implements IProcessManager {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private state: ServerState = { status: 'stopped', restarts: 0 };
  private restartTimer: Timer | null = null;
  private logs = new LogBuffer(5_000);
  private outputIdx = 0;

  getState(): ServerState {
    return { ...this.state };
  }

  async start(): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting') {
      throw new Error('Server is already running or starting');
    }

    const config = loadConfig();
    this.setState('starting');

    const args = ['+exec', config.configFile, '+set', 'onesync', 'on'];

    console.log(`[core] Starting FiveM: ${config.executable} ${args.join(' ')}`);

    try {
      this.proc = Bun.spawn([config.executable, ...args], {
        cwd: config.serverDataPath,
        stdin: 'pipe',
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      });

      this.setState('running', { pid: this.proc.pid, startedAt: new Date() });
      repo.audit.log({ adminId: 'system', action: 'server.start' });

      this.pipeOutput(this.proc.stdout, 'stdout');
      this.pipeOutput(this.proc.stderr, 'stderr');

      // Watch for exit
      this.proc.exited.then((code) => this.onExit(code));
    } catch (err) {
      this.setState('crashed');
      throw err;
    }
  }

  async stop(): Promise<void> {
    if (!this.proc || this.state.status === 'stopped') {
      throw new Error('Server is not running');
    }

    this.setState('stopping');
    if (this.restartTimer) clearTimeout(this.restartTimer);

    this.proc.kill();
    await this.proc.exited;
    this.setState('stopped');
    repo.audit.log({ adminId: 'system', action: 'server.stop' });
  }

  async restart(): Promise<void> {
    if (this.state.status === 'running') await this.stop();
    await this.start();
    repo.audit.log({ adminId: 'system', action: 'server.restart' });
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

  getConsoleContent() {
    return this.logs.getHistory();
  }

  // region private

  private setState(status: ServerStatus, extra: Partial<ServerState> = {}) {
    this.state = { ...this.state, status, ...extra };
    this.emit('state', this.getState());
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

  private async pipeOutput(
    stream: ReadableStream<Uint8Array> | undefined,
    source: 'stdout' | 'stderr',
  ) {
    if (!stream) return;

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

        // wacky workaround for key value in UI
        this.outputIdx++;

        const event: ConsoleOutputEvent = {
          id: this.outputIdx,
          line: value,
          segments: this.parseAnsiToSegments(value),
          source,
          ts: Date.now(),
        };

        this.logs.push(event);
        this.emit('console', event);
      }
    } catch (err) {
      console.error(`Stream error:`, err);
    }
  }

  private parseAnsiToSegments(ansiStr: string): LogSegment[] {
    // look into 'ansi-to-json' package
    const ansiRegex = /\x1B\[([0-9;]*)m/g;
    let parts = ansiStr.split(ansiRegex);
    const segments: LogSegment[] = [];

    let currentColor = '';

    for (let i = 0; i < parts.length; i++) {
      if (i % 2 === 0) {
        // This is text
        if (parts[i]) {
          segments.push({ text: parts[i], color: currentColor });
        }
      } else {
        // This is an ANSI code
        const code = parts[i];
        if (code === '0') currentColor = '';
        else if (code.startsWith('38;5;')) {
          // fxserver uses 256-color palette
          const colorIndex = code.split(';')[2];
          currentColor = this.get256Color(parseInt(colorIndex));
        }
      }
    }
    return segments;
  }

  private get256Color(index: number): string {
    const palette: Record<number, string> = {
      83: '#5af761',
      161: '#d7005f',
      165: '#d700ff',
      73: '#5fafaf',
      208: '#ff8700',
      220: '#ffd700',
      33: '#0087ff',
      196: '#ff0000',
      46: '#00ff00',
      21: '#0000ff',
      226: '#ffff00',
      201: '#ff00ff',
      51: '#00ffff',
      231: '#ffffff',
      232: '#080808',
      244: '#808080',
      250: '#bcbcbc',
      23: '#005f5f',
      42: '#00d787',
      66: '#5f8787',
      135: '#af5fff',
      177: '#d787ff',
    };

    if (palette[index]) return palette[index];

    console.warn('No colour found for', index);

    return '#ffffff';
  }

  private async onExit(code: number | null) {
    const config = loadConfig();
    const crashed = code !== 143 && code !== 0 && code !== null && this.state.status !== 'stopping';

    if (crashed) {
      console.warn(`[core] FiveM process exited with code ${code}`);
      this.setState('crashed', { lastCrashAt: new Date() });

      if (config.autoRestart && this.state.restarts < config.maxRestarts) {
        const delay = config.restartDelayMs;
        console.log(
          `[core] Restarting in ${delay}ms (attempt ${this.state.restarts + 1}/${config.maxRestarts})`,
        );
        this.state.restarts++;
        this.restartTimer = setTimeout(() => this.start(), delay);
      } else {
        console.error('[core] Max restarts reached — giving up');
        this.setState('stopped');
      }
    } else {
      console.log('[core] FiveM process exited');
      this.setState('stopped');
    }

    this.proc = null;
  }
}

// Singleton
export const processManager = new ProcessManager();
