import { EventEmitter } from 'events';
import type { IProcessManager } from '@fxmanager/types';
import { join } from 'path';
import { repo } from '@fxmanager/database';
import { loadConfig } from '../config';
import type { ServerState, ServerStatus, ConsoleOutputEvent } from '@fxmanager/types';

export class ProcessManager extends EventEmitter implements IProcessManager {
  private proc: ReturnType<typeof Bun.spawn> | null = null;
  private state: ServerState = { status: 'stopped', restarts: 0 };
  private restartTimer: Timer | null = null;
  private stdoutReader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private stderrReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

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
    if (!this.proc?.stdin) throw new Error('Server stdin not available');
    const writer = this.proc.stdin.getWriter();
    writer.write(new TextEncoder().encode(command + '\n'));
    writer.releaseLock();
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private setState(status: ServerStatus, extra: Partial<ServerState> = {}) {
    this.state = { ...this.state, status, ...extra };
    this.emit('state', this.getState());
  }

  private async pipeOutput(
    stream: ReadableStream<Uint8Array> | undefined,
    source: 'stdout' | 'stderr',
  ) {
    if (!stream) return;
    const decoder = new TextDecoder();
    const reader = stream.getReader();
    if (source === 'stdout') this.stdoutReader = reader;
    else this.stderrReader = reader;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(Boolean);
        for (const line of lines) {
          const event: ConsoleOutputEvent = { line, source };
          this.emit('console', event);
        }
      }
    } catch {
      // Stream closed
    }
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
      console.log('[core] FiveM process exited')
      this.setState('stopped');
    }

    this.proc = null;
  }
}

// Singleton
export const processManager = new ProcessManager();
