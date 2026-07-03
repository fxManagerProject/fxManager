import { repo } from '@fxmanager/database';
import {
	type DisconnectSession,
	type ServerSession,
	zeroDisconnectCounts,
} from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';
import { classifyDrop } from './classify-drop';

class DisconnectManager {
	private live: DisconnectSession | null = null;

	onSessionOpen(session: ServerSession): void {
		this.live = {
			id: session.id,
			startedAt: session.startedAt,
			endedAt: null,
			...zeroDisconnectCounts(),
		};
		this.broadcast();
	}

	onSessionClose(session: ServerSession | null): void {
		if (!this.live) return;
		if (session) this.live.endedAt = session.endedAt;
		this.broadcast();
		this.live = null;
	}

	recordDrop(payload: {
		reason: unknown;
		resourceName?: string;
		category?: number;
	}): void {
		const category = classifyDrop(payload);
		if (!category || !this.live) return;
		this.live[category] += 1;
		repo.disconnects.recordEvent(this.live.id, Date.now(), category);
		this.broadcast();
	}

	getLiveSession(): DisconnectSession | null {
		return this.live;
	}

	private broadcast(): void {
		if (!this.live) return;
		wsManager.broadcast<DisconnectSession>({
			channel: 'disconnects',
			event: 'update',
			data: this.live,
		});
	}
}

export const disconnectManager = new DisconnectManager();
