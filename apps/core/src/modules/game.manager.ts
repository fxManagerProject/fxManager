import EventEmitter from 'events';
import { repo } from '@fxmanager/database';
import { EventNames } from '@fxmanager/shared/constants';
import {
	type ApiResponse,
	type BanDataCard,
	type DeferralCheckResponse,
	type OnlinePlayer,
	type PlayerIdentifiers,
	type PlayerUpdatePackage,
} from '@fxmanager/shared/types';
import { loadConfig } from '../common/config';
import { wsManager } from './ws.manager';

export class GameManager {
	private playerlist: OnlinePlayer[] = [];
	private apiToken: string;

	constructor() {
		const { resourceApiToken } = loadConfig();
		this.apiToken = resourceApiToken;
	}

	// region player handling

	getPlayerList() {
		return this.playerlist;
	}

	getPlayer(id: number) {
		return this.playerlist.find((p) => p.id === id);
	}

	// region receiving actions

	playerDeferralChecks(identifiers: PlayerIdentifiers): DeferralCheckResponse {
		const ban = repo.players.checkBanned(identifiers);

		if (ban) {
			const isPerm = ban.expiresAt === null;

			let data: BanDataCard;

			if (isPerm)
				data = {
					permanent: true,
					reason: ban.reason,
					createdAt: ban.createdAt,
				};
			else
				data = {
					permanent: false,
					reason: ban.reason,
					createdAt: ban.createdAt,
					expiresAt: ban.expiresAt!,
				};

			return {
				access: false,
				type: 'ban',
				ban: data,
			};
		}

		/* ToDo: Add whitelist checks */

		return { access: true };
	}

	async playerJoin({
		name,
		identifiers,
		serverId,
	}: {
		name: string;
		identifiers: PlayerIdentifiers;
		serverId: number;
	}) {
		const player = await repo.players.upsert(name, identifiers);

		const playerPayload = {
			serverId,
			health: -1,
			...player,
		} satisfies OnlinePlayer;

		this.playerlist.push(playerPayload);
		wsManager.broadcast<OnlinePlayer>({
			channel: 'playerlist',
			event: 'player_joined',
			data: playerPayload,
		});
	}

	async playerDrop(serverId: number) {
		const index = this.playerlist.findIndex((p) => p.serverId === serverId);

		if (index === -1) {
			console.warn(
				`[core] A player (${serverId}) disconnected but wasn't tracked!`,
			);
			return;
		}

		const [player] = this.playerlist.splice(index, 1);
		if (!player) {
			console.warn(
				`[core] A player (${serverId}) disconnected but wasn't tracked!`,
			);
			return;
		}

		const sessionDuration = Date.now() - player.lastSeen.getTime();
		const newPlaytime = player.playtime + sessionDuration;

		repo.players.updatePlaytime(player.id, newPlaytime);
		wsManager.broadcast<{ serverId: number }>({
			channel: 'playerlist',
			event: 'player_left',
			data: { serverId },
		});
	}

	async playerUpdates(data: PlayerUpdatePackage) {
		for (const [idString, [health, ping]] of Object.entries(data)) {
			// record keys are converted to strings so we typed it as such as well
			const serverId = parseInt(idString);

			const player = this.playerlist.find((p) => p.serverId === serverId);

			if (player) {
				player.health = health;
				player.ping = ping;
			}
		}

		wsManager.broadcast<PlayerUpdatePackage>({
			channel: 'playerlist',
			event: 'player_update',
			data,
		});
	}

	// region emitting actions

	async dropPlayer(serverId: number, reason: string): Promise<ApiResponse> {
		try {
			const response = await fetch('http://localhost:30120/fxManager/drop', {
				method: 'POST',
				body: JSON.stringify({
					serverId,
					reason,
				}),
				headers: {
					Application: 'json/application',
					'x-resource-token': this.apiToken,
				},
			});

			if (!response.ok) {
				return {
					success: false,
					error: `Server responded with ${response.status}: ${response.statusText}`,
				};
			}

			const result = (await response.json()) as ApiResponse;

			if (result.success) {
				return {
					success: true,
					data: null,
				};
			}

			return {
				success: false,
				error: result.error ?? 'Unable to fulfill drop request',
			};
		} catch (err) {
			return {
				success: false,
				error: (err as Error).message,
			};
		}
	}
}
