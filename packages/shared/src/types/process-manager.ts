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
