import type { PlayerUpdatePackage } from '@fxmanager/shared/types';
import { QueryManager } from '../utils/query';

class PlayerManager {
	private players: Map<string, { permissions: number }> = new Map();
	private updateInterval: NodeJS.Timeout | null = null;

	addPlayer(source: number, permissions: number = 0) {
		if (this.players.size === 0) this.startUpdates();
		this.players.set(`${source}`, { permissions });
	}

	removePlayer(source: number) {
		this.players.delete(`${source}`);
		if (this.players.size === 0) this.clearUpdates();
	}

	dropAll(reason: string): number {
		const ids = [...this.players.keys()];
		for (const id of ids) DropPlayer(id, reason);
		return ids.length;
	}

	private startUpdates() {
		this.updateInterval = setInterval(async () => {
			const updatePacket: PlayerUpdatePackage = {};

			for (const src of this.players.keys()) {
				const ped = GetPlayerPed(src);
				const health = GetEntityHealth(ped);
				const ping = GetPlayerPing(src);

				updatePacket[src] = [health, ping];
			}

			if (Object.keys(updatePacket).length === 0)
				return console.warn('NO DATA FOR UPDATE INTERVAL');

			await QueryManager({
				endpoint: '/players/update',
				method: 'POST',
				body: { payload: updatePacket },
			});
		}, 5_000);
	}

	private clearUpdates() {
		if (!this.updateInterval) return;
		clearInterval(this.updateInterval);
		this.updateInterval = null;
	}
}

export const playerManager = new PlayerManager();
