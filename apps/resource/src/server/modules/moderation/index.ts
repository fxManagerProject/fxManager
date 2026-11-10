import {
	CALLBACK_NAMES,
	EVENT_NAMES,
	type PanelPlayer,
	type PlayerActionReply,
} from '@common/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import type {
	ClientPlayerBlipUpdate,
	OnlinePlayer,
} from '@fxmanager/shared/types';
import { ServerCallbacks } from '../../utils/callbacks';
import { getPermissions } from '../../utils/permissions';
import { QueryManager } from '../../utils/query';
import { isPlayerAction } from './validation';

const denied = {
	success: false,
	message: 'Action refused or server unavailable.',
};
const viewers = new Set<number>();
const actionsInFlight = new Set<number>();
const actionPermissions = {
	warn: UserPermissions.WARN,
	kick: UserPermissions.KICK,
	ban: UserPermissions.BAN,
};

ServerCallbacks.register<unknown, PanelPlayer[] | null>(
	CALLBACK_NAMES.LIST_PLAYERS,
	async (_, payload) => {
		if (
			payload !== null &&
			payload !== undefined &&
			(typeof payload !== 'object' || Array.isArray(payload))
		)
			return null;
		const { query, scope } = (payload ?? {}) as {
			query?: unknown;
			scope?: unknown;
		};
		if (
			(query !== undefined &&
				(typeof query !== 'string' || query.length > 100)) ||
			(scope !== undefined && scope !== 'online' && scope !== 'all')
		)
			return null;
		const search = typeof query === 'string' ? query.trim() : '';

		const online = (
			await QueryManager<OnlinePlayer[]>({
				endpoint: '/ingame/players',
				method: 'GET',
			})
		).map((player) => {
			const source = String(player.serverId);
			const ped = GetPlayerPed(source);
			return {
				online: true,
				playerId: player.id,
				serverId: player.serverId,
				name: player.name,
				ping: GetPlayerPing(source),
				bucket: GetPlayerRoutingBucket(source),
				...(ped && DoesEntityExist(ped)
					? {
							health: GetEntityHealth(ped),
							maxHealth: GetEntityMaxHealth(ped),
							armour: GetPedArmour(ped),
							inVehicle: GetVehiclePedIsIn(ped, false) !== 0,
						}
					: {}),
			};
		});
		const onlineMatches = online.filter(
			(player) =>
				!search ||
				player.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) ||
				String(player.serverId) === search,
		);
		if (scope === 'online' || (!scope && !search)) return onlineMatches;
		const matches = await QueryManager<{
			items: { id: number; name: string; lastSeen?: string }[];
		}>({
			endpoint: `/ingame/players/search?q=${encodeURIComponent(search)}&pageSize=50`,
			method: 'GET',
		});
		const found = new Map<number, PanelPlayer>(
			matches.items.map((player) => [
				player.id,
				online.find((item) => item.playerId === player.id) ?? {
					playerId: player.id,
					name: player.name,
					online: false,
					lastSeen: player.lastSeen
						? new Date(player.lastSeen).getTime()
						: undefined,
					serverId: 0,
					ping: 0,
				},
			]),
		);
		for (const player of onlineMatches) found.set(player.playerId, player);
		return [...found.values()].sort(
			(a, b) => Number(b.online) - Number(a.online),
		);
	},
	{ permission: 'PLAYER_MONITORING', fallback: null },
);

ServerCallbacks.register<unknown, PlayerActionReply>(
	CALLBACK_NAMES.PLAYER_ACTION,
	async (source, payload) => {
		if (!isPlayerAction(payload))
			return { success: false, message: 'Invalid player action.' };
		if (
			!PermissionManager.has(
				getPermissions(source),
				actionPermissions[payload.action],
			)
		)
			return denied;
		if (
			payload.action === 'kick' &&
			(payload.target < 1 || !GetPlayerName(String(payload.target)))
		)
			return {
				success: false,
				message: 'Player has disconnected. Refresh the list.',
			};
		if (actionsInFlight.has(source))
			return { success: false, message: 'An action is already pending.' };
		actionsInFlight.add(source);
		try {
			await QueryManager({
				endpoint: `/ingame/${payload.action === 'ban' ? 'bans' : payload.action}`,
				method: 'POST',
				signal: AbortSignal.timeout(10000),
				body: {
					target: { playerId: payload.playerId },
					reason: payload.reason.trim(),
					durationSeconds: payload.durationSeconds,
					by: source,
					resource: GetCurrentResourceName(),
				},
			});
			return {
				success: true,
				message: `${payload.action === 'warn' ? 'Warning recorded' : payload.action === 'kick' ? 'Player kicked' : 'Player banned'}.`,
			};
		} catch (error) {
			return {
				success: false,
				message: error instanceof Error ? error.message : denied.message,
			};
		} finally {
			actionsInFlight.delete(source);
		}
	},
	{ permission: 'PLAYER_MONITORING', fallback: denied },
);

ServerCallbacks.register<boolean, boolean>(
	CALLBACK_NAMES.TOGGLE_BLIPS,
	(source, enabled) => {
		if (typeof enabled !== 'boolean') return false;
		if (enabled) viewers.add(source);
		else viewers.delete(source);
		return true;
	},
	{ permission: 'PLAYER_MONITORING', fallback: false },
);

on('playerDropped', () => {
	viewers.delete(globalThis.source);
	actionsInFlight.delete(globalThis.source);
});
setInterval(() => {
	if (viewers.size === 0) return;
	for (const source of viewers) {
		if (
			!GetPlayerName(String(source)) ||
			!PermissionManager.has(
				getPermissions(source),
				UserPermissions.PLAYER_MONITORING,
			)
		) {
			viewers.delete(source);
			emitNet(EVENT_NAMES.S2C_UPDATE_PLAYERS, source, {});
			continue;
		}
		const payload: ClientPlayerBlipUpdate = {};
		for (const id of getPlayers()) {
			if (GetPlayerRoutingBucket(id) !== GetPlayerRoutingBucket(String(source)))
				continue;
			const ped = GetPlayerPed(id);
			if (!ped || !DoesEntityExist(ped)) continue;
			payload[id] = {
				username: GetPlayerName(id),
				coords: GetEntityCoords(ped) as [number, number, number],
				inVehicle: GetVehiclePedIsIn(ped, false) !== 0,
				dead: GetEntityHealth(ped) <= 0,
				heading: GetEntityHeading(ped),
			};
		}
		emitNet(EVENT_NAMES.S2C_UPDATE_PLAYERS, source, payload);
	}
}, 1000);
