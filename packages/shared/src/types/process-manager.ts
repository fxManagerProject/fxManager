export type ProcessState =
	| 'running'
	| 'starting'
	| 'stopping'
	| 'stopped'
	| 'crashed';

export interface ServerState {
	status: ProcessState;
	startedAt: Date | null;
}

export interface ProcessOutputLine {
	line: string;
	source: 'stdout' | 'stderr';
	ts: number;
}
