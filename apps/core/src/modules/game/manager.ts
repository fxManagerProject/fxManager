import { repo } from '@fxmanager/database';
import type {
	WhitelistMode,
	ApiResponse,
	BanDataCard,
	DeferralCheckResponse,
	OnlinePlayer,
	PlayerIdentifiers,
	PlayerUpdatePackage,
} from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';
import { discordManager } from '../discord/manager';
import { ConfigManager } from '../config/manager';
import { aceSync } from '../ace/manager';
import { disconnectManager } from '../disconnect/manager';
import { sessionManager } from '../session/manager';
import { getServerNetEndpoint } from '../../common/fxserver-endpoint';

export class GameManager {
	private playerlist: OnlinePlayer[] = [];
	private config = ConfigManager.getInstance();

	private async getApiToken() {
		const { resourceApiToken } = this.config.getSystemValues();
		return resourceApiToken;
	}

	// region player handling

	getPlayerList() {
		return this.playerlist;
	}

	getPlayer(id: number) {
		return this.playerlist.find((p) => p.id === id);
	}

	/** Drop all tracked players when a server session opens or closes. */
	resetPlayerlist() {
		this.playerlist = [];
		sessionManager.setPlayerCount(0);
	}

	// region receiving actions

	async playerDeferralChecks(
		identifiers: PlayerIdentifiers,
	): Promise<DeferralCheckResponse> {
		const ban = repo.players.checkBanned(identifiers);

		if (ban) {
			let data: BanDataCard;

			if (ban.expiresAt === null)
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
					expiresAt: ban.expiresAt,
				};

			return {
				access: false,
				type: 'ban',
				ban: data,
			};
		}

		const setting = repo.settings.get<WhitelistMode>('whitelist.mode');
		const player = repo.players.findByLicense(identifiers.license);
		const isAdmin = player ? repo.players.isStaff(player.id) : false;

		if (!setting || setting === 'none' || isAdmin) return { access: true };

		if (setting === 'admin-only') {
			return {
				access: false,
				type: 'error',
				reason:
					'Server is in Administer Mode, you can not connect at this time.',
			};
		} else if (setting === 'identifier') {
			const isWhitelisted =
				await repo.whitelist.isAnyIdentifierWhitelisted(identifiers);

			if (isWhitelisted) {
				return { access: true };
			} else {
				return {
					access: false,
					type: 'error',
					reason: 'You are not whitelisted.',
				};
			}
		} else if (setting === 'discord') {
			if (!discordManager.isConnected()) {
				try {
					await discordManager.connect();
				} catch (err) {
					const msg = (err as Error).message;
					console.error(
						"Game manager can't check discord whitelist as the discord manager couldn't connect:",
						msg,
					);

					return {
						access: false,
						type: 'error',
						reason:
							'Unable to check whitelist status, please contact server administrators',
					};
				}
			}

			if (!identifiers.discord) {
				return {
					access: false,
					type: 'error',
					reason: 'No discord identifier found.',
				};
			}

			const whitelisted = await discordManager.checkWhitelist(
				identifiers.discord,
			);

			if (whitelisted) {
				return { access: true };
			} else {
				return {
					access: false,
					type: 'error',
					reason:
						'You are not whitelisted, please address yourself to server staff.',
				};
			}
		}

		console.warn(
			'[game.manager] an invalid whitelist.mode was set, connections will be refused.',
		);
		return {
			access: false,
			type: 'error',
			reason: 'Server whitelist mode is not set, please inform server owner.',
		};
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

		if (player.isStaff) aceSync.refresh();

		const playerPayload = {
			serverId,
			health: -1,
			...player,
		} satisfies OnlinePlayer;

		const existing = this.playerlist.findIndex((p) => p.serverId === serverId);
		if (existing !== -1) this.playerlist[existing] = playerPayload;
		else this.playerlist.push(playerPayload);
		sessionManager.setPlayerCount(this.playerlist.length);
		wsManager.broadcast<OnlinePlayer>({
			channel: 'playerlist',
			event: 'player_joined',
			data: playerPayload,
		});
	}

	async playerDrop(
		serverId: number,
		drop?: { reason?: unknown; resourceName?: string; category?: number },
	) {
		const index = this.playerlist.findIndex((p) => p.serverId === serverId);

		if (index === -1) {
			console.warn(
				`[core] A player (${serverId}) disconnected but wasn't tracked!`,
			);
			return;
		}

		if (drop) {
			disconnectManager.recordDrop({
				reason: drop.reason,
				resourceName: drop.resourceName,
				category: drop.category,
			});
		}

		const [player] = this.playerlist.splice(index, 1);
		sessionManager.setPlayerCount(this.playerlist.length);
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
			const serverId = parseInt(idString, 10);

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
			const resourceToken = await this.getApiToken();
			const endpoint = await getServerNetEndpoint();
			const response = await fetch(`http://${endpoint}/fxManager/drop`, {
				method: 'POST',
				body: JSON.stringify({
					serverId,
					reason,
				}),
				headers: {
					Application: 'json/application',
					'x-resource-token': resourceToken,
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

export const gameManager = new GameManager();
