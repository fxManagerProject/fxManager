import { IProcessManager, ServerState, ServerStatus } from '@fxmanager/types';
import { EventEmitter } from 'events';
import { startPanel } from '.';

class MockProcessManager extends EventEmitter implements IProcessManager {
  // Initialize the full state object
  private state: ServerState = {
    status: 'stopped',
    restarts: 0,
    pid: undefined,
    startedAt: undefined,
    lastCrashAt: undefined
  };

  getState(): ServerState {
    return this.state;
  }

  private updateStatus(newStatus: ServerStatus) {
    this.state = {
      ...this.state,
      status: newStatus,
      // Update metadata based on status logic
      pid: newStatus === 'running' ? Math.floor(Math.random() * 10000) : undefined,
      startedAt: newStatus === 'running' ? new Date() : this.state.startedAt,
      restarts: newStatus === 'starting' ? this.state.restarts + 1 : this.state.restarts,
      lastCrashAt: newStatus === 'crashed' ? new Date() : this.state.lastCrashAt
    };
    
    this.emit('stateChange', this.state);
    this.emit('log', `System state updated to: ${newStatus}`);
  }

  async start(): Promise<void> {
    if (this.state.status === 'running') return;
    
    this.updateStatus('starting');
    await new Promise(r => setTimeout(r, 1500));
    this.updateStatus('running');
  }

  async stop(): Promise<void> {
    this.updateStatus('stopping');
    await new Promise(r => setTimeout(r, 1000));
    this.updateStatus('stopped');
  }

  async restart(): Promise<void> {
    await this.stop();
    await this.start();
  }

  sendCommand(command: string): void {
    this.emit('log', `[CMD]: ${command}`);
    if (command === 'kill') this.updateStatus('crashed');
  }
}

const mockProcess = new MockProcessManager();

startPanel(mockProcess);
