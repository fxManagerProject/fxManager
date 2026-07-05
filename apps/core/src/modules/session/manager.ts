import { repo } from '@fxmanager/database';
import type { ServerSession } from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';

class SessionManager {
	private current: ServerSession | null = null;
	private playerCount = 0;

	init(): void {
		repo.serverSessions.closeDangling();
		repo.playerSessions.closeDangling();
	}

	openSession(): ServerSession {
		if (this.current) return this.current;
		this.current = repo.serverSessions.open();
		this.playerCount = 0;
		this.broadcastSessions();
		return this.current;
	}

	closeSession(reason: string | null = null): ServerSession | null {
		if (!this.current) return null;
		const closed = repo.serverSessions.close(this.current.id, reason);
		repo.serverSessions.prune();
		this.current = null;
		this.playerCount = 0;
		this.broadcastSessions();
		return closed;
	}

	private broadcastSessions(): void {
		wsManager.broadcast<ServerSession[]>({
			channel: 'sessions',
			event: 'update',
			data: repo.serverSessions.listRecent(50),
		});
	}

	getCurrent(): ServerSession | null {
		return this.current;
	}

	getCurrentId(): number | null {
		return this.current?.id ?? null;
	}

	setPlayerCount(n: number): void {
		this.playerCount = n;
	}

	getPlayerCount(): number {
		return this.playerCount;
	}
}

export const sessionManager = new SessionManager();
