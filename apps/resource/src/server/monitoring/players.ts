import type { PlayerUpdatePackage } from '@fxmanager/shared/types';
import { QueryManager } from '../utils/query';
import { getPermissions } from '../utils/permissions';
import { type UserPermissionKey } from '@common/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { Vector3 } from '@nativewrappers/fivem';

export interface PlayerFilter {
	/** only return sources holding this permission (master admins always match) */
	permission?: UserPermissionKey;
}

export interface TrackedPlayer {
	name: string;
	staff: boolean;
	permissions: number;
	joinedAt?: number;
	ped?: number;
	coords?: Vector3;
	ping?: number;
	health?: number;
}

/** how long the manager will track raw player count samples in ms */
const HISTORY_LENGTH = 60_000 * 60;

/** a timestamped player-count sample written by the monitor interval */
export interface PlayerCountSample {
	ts: number;
	players: number;
}

class PlayerManager {
	private playerHistory: PlayerCountSample[] = [];
	private players: Map<string, TrackedPlayer> = new Map();
	private updateInterval: NodeJS.Timeout | null = null;
	private tickListeners = new Set<() => void>();

	addPlayer(source: number) {
		if (this.players.size === 0) this.startUpdates();

		const name = GetPlayerName(String(source));
		const permissions = getPermissions(source);
		this.players.set(`${source}`, {
			permissions,
			name,
			staff: permissions !== 0,
			joinedAt: Date.now(),
		});
	}

	removePlayer(source: number) {
		this.players.delete(`${source}`);
		if (this.players.size === 0) this.clearUpdates();
	}

	updatePlayer(source: string | number, data: Partial<TrackedPlayer>) {
		source = typeof source === 'string' ? source : String(source);

		const player = this.getPlayer(source);
		if (!player) return;

		const updates: Partial<TrackedPlayer> = {};

		if (data.name !== undefined) {
			if (typeof data.name === 'string' && data.name.trim().length > 0) {
				updates.name = data.name.trim();
			}
		}

		if (data.staff !== undefined) {
			updates.staff = Boolean(data.staff);
		}

		if (data.permissions !== undefined) {
			if (typeof data.permissions === 'number' && !isNaN(data.permissions)) {
				updates.permissions = Math.max(0, data.permissions);
			}
		}

		if (data.ped !== undefined) {
			const ped = data.ped ?? GetPlayerPed(source);
			if (ped > 0) {
				updates.ped = ped;
			}
		}

		if (data.coords !== undefined) {
			if (data.coords) {
				updates.coords = data.coords;
			}
		}

		if (data.ping !== undefined) {
			if (typeof data.ping === 'number' && data.ping >= 0) {
				updates.ping = data.ping;
			}
		}

		if (data.health !== undefined) {
			if (typeof data.health === 'number' && data.health >= 0) {
				updates.health = data.health;
			}
		}

		Object.assign(player, updates);

		return player;
	}

	dropAll(reason: string): number {
		const ids = [...this.players.keys()];
		for (const id of ids) DropPlayer(id, reason);
		return ids.length;
	}

	getPlayer(source: number | string) {
		return this.players.get(
			typeof source === 'string' ? source : String(source),
		);
	}

	isAllowed(source: number | string, permission: UserPermissionKey) {
		const player = this.players.get(
			typeof source === 'string' ? source : String(source),
		);

		if (!player) return false;

		return PermissionManager.has(
			player.permissions,
			UserPermissions[permission],
		);
	}

	/**
	 * Tracked player sources as numbers. Optionally filter by a permission
	 * (bitfield check against the cached snapshot).
	 */
	getPlayers(filter?: PlayerFilter): number[] {
		const sources = [...this.players.keys()].map(Number);

		const { permission } = filter ?? {};
		if (!permission) return sources;

		return sources.filter((src) => this.isAllowed(src, permission));
	}

	/** capture the player's ped once it spawned (called on playerJoined) */
	updatePlayerPed(source: number | string) {
		const src = String(source);
		const ped = GetPlayerPed(src);
		if (ped > 0) this.updatePlayer(src, { ped });
	}

	/**
	 * Register a listener fired at the end of every monitor tick
	 */
	onTick(listener: () => void): () => void {
		this.tickListeners.add(listener);
		return () => this.tickListeners.delete(listener);
	}

	/**
	 * Raw player-count samples captured at the monitor cadence (do not assume
	 * their resolution or shape; consumers aggregate what they need).
	 */
	getRawPlayerHistory(): PlayerCountSample[] {
		return [...this.playerHistory];
	}

	private updateHistory(players: number) {
		const now = Date.now();
		this.playerHistory.push({ ts: now, players });

		const cutoff = now - HISTORY_LENGTH;

		while (this.playerHistory[0] && this.playerHistory[0].ts < cutoff) {
			this.playerHistory.shift();
		}
	}

	private startUpdates() {
		this.updateInterval = setInterval(async () => {
			const updatePacket: PlayerUpdatePackage = {};
			let playerCount = 0;

			for (const src of this.players.keys()) {
				const ped = GetPlayerPed(src);
				playerCount++;

				if (ped <= 0) continue; // sanity check

				const health = GetEntityHealth(ped);
				const ping = GetPlayerPing(src);
				const coords = Vector3.fromArray(GetEntityCoords(ped));
				const coordsArray = coords.toArray();

				updatePacket[src] = [health, ping, coordsArray];

				this.updatePlayer(src, { ped, coords, health, ping });
			}

			if (Object.keys(updatePacket).length === 0)
				return console.warn('NO DATA FOR UPDATE INTERVAL');

			this.updateHistory(playerCount);

			await QueryManager({
				endpoint: '/players/update',
				method: 'POST',
				body: { payload: updatePacket },
			});

			for (const listener of this.tickListeners) listener();
		}, 5_000);
	}

	private clearUpdates() {
		if (!this.updateInterval) return;
		clearInterval(this.updateInterval);
		this.updateInterval = null;
	}
}

export const playerManager = new PlayerManager();

// Resource restarts must restore monitoring for players who are already connected.
for (const id of getPlayers()) playerManager.addPlayer(Number(id));
