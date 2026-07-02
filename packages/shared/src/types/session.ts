/** A single server run (between restarts). Timestamps are epoch ms. */
export interface ServerSession {
	id: number;
	startedAt: number;
	endedAt: number | null;
	closeReason: string | null;
}
