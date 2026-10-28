import { NuiCallback } from '../../utils/nui-callbacks';
import { permissions } from '../../utils/permissions';
import { updateMenuStore } from '../nui/quickmenu';

let enabled = false;
const tags = new Map<number, { ped: number; handle: number }>();
let lastCount = -1;
function publishCount() {
	if (lastCount === tags.size) return;
	lastCount = tags.size;
	SendNUIMessage({ action: 'tag-count', data: tags.size });
}
function showTag(handle: number, talking: boolean) {
	for (const component of [0, 2, 4]) SetMpGamerTagAlpha(handle, component, 255);
	SetMpGamerTagVisibility(handle, 0, true);
	SetMpGamerTagVisibility(handle, 2, true);
	SetMpGamerTagHealthBarColour(handle, 18);
	SetMpGamerTagVisibility(handle, 4, talking);
}
function clearTags() {
	for (const tag of tags.values()) RemoveMpGamerTag(tag.handle);
	tags.clear();
	publishCount();
}
NuiCallback<unknown, { count: number }>('get-tag-count', (_, reply) =>
	reply({ count: tags.size }),
);
NuiCallback<boolean, boolean>('moderation-tags', (value, reply) => {
	if (
		typeof value !== 'boolean' ||
		(value && !permissions.has('PLAYER_MONITORING'))
	)
		return reply(false);
	enabled = value;
	if (!enabled) clearTags();
	updateMenuStore('tags', enabled);
	reply(true);
});
setInterval(() => {
	if (!enabled) return;
	if (!permissions.has('PLAYER_MONITORING')) {
		enabled = false;
		clearTags();
		updateMenuStore('tags', false);
		return;
	}
	const visible = new Set<number>();
	const [x, y, z] = GetEntityCoords(PlayerPedId(), false) as [
		number,
		number,
		number,
	];
	for (const player of GetActivePlayers()) {
		if (player === PlayerId()) continue;
		const ped = GetPlayerPed(player);
		const [px, py, pz] = GetEntityCoords(ped, false) as [
			number,
			number,
			number,
		];
		if (!DoesEntityExist(ped) || Math.hypot(px - x, py - y, pz - z) > 150)
			continue;
		visible.add(player);
		let tag = tags.get(player);
		if (tag && tag.ped !== ped) {
			RemoveMpGamerTag(tag.handle);
			tags.delete(player);
			tag = undefined;
		}
		if (!tag) {
			tag = {
				ped,
				handle: CreateFakeMpGamerTag(
					ped,
					`[${GetPlayerServerId(player)}] ${GetPlayerName(player).replace(/~/g, '')}`,
					false,
					false,
					'',
					0,
				),
			};
			tags.set(player, tag);
		}
		SetMpGamerTagName(
			tag.handle,
			`[${GetPlayerServerId(player)}] ${GetPlayerName(player).replace(/~/g, '').slice(0, 32)} | AR ${GetPedArmour(ped)}`,
		);
		showTag(tag.handle, NetworkIsPlayerTalking(player));
	}
	for (const [player, tag] of tags) {
		if (!visible.has(player)) {
			RemoveMpGamerTag(tag.handle);
			tags.delete(player);
		}
	}
	publishCount();
}, 250);
on('onResourceStop', (name: string) => {
	if (name === GetCurrentResourceName()) {
		clearTags();
	}
});
