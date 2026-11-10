import { CALLBACK_NAMES, EVENT_NAMES } from '@common/types';
import type { ClientPlayerBlipUpdate } from '@fxmanager/shared/types';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';
import { permissions } from '../../utils/permissions';
import { updateMenuStore } from '../nui/quickmenu';

class BlipManager {
	public enabled = false;
	private blips = new Map<string, number>();
	clearBlips() {
		for (const blip of this.blips.values()) RemoveBlip(blip);
		this.blips.clear();
	}
	syncBlips(payload: ClientPlayerBlipUpdate) {
		if (!this.enabled) return;
		for (const [id, blip] of this.blips) {
			if (!payload[id]) {
				RemoveBlip(blip);
				this.blips.delete(id);
			}
		}
		for (const [id, player] of Object.entries(payload)) {
			if (Number(id) === GetPlayerServerId(PlayerId())) continue;
			let blip = this.blips.get(id);
			if (!blip || !DoesBlipExist(blip)) {
				blip = AddBlipForCoord(...player.coords);
				this.blips.set(id, blip);
				SetBlipScale(blip, 0.8);
				SetBlipCategory(blip, 7);
			}
			SetBlipCoords(blip, ...player.coords);
			SetBlipSprite(blip, player.dead ? 274 : player.inVehicle ? 225 : 1);
			SetBlipColour(blip, player.dead ? 1 : 47);
			SetBlipRotation(blip, Math.round(player.heading ?? 0));
			ShowHeadingIndicatorOnBlip(blip, !player.dead);
			BeginTextCommandSetBlipName('STRING');
			AddTextComponentSubstringPlayerName(
				`${player.username.replace(/~/g, '')} [${id}]`,
			);
			EndTextCommandSetBlipName(blip);
		}
	}
}
export const blipManager = new BlipManager();
onNet(EVENT_NAMES.S2C_UPDATE_PLAYERS, (payload: ClientPlayerBlipUpdate) =>
	blipManager.syncBlips(payload),
);
NuiCallback<boolean, boolean>('moderation-blips', async (enabled, reply) => {
	if (
		typeof enabled !== 'boolean' ||
		(enabled && !permissions.has('PLAYER_MONITORING'))
	)
		return reply(false);
	const accepted = await ClientCallbacks.trigger<boolean>(
		CALLBACK_NAMES.TOGGLE_BLIPS,
		enabled,
		{ fallback: false },
	);
	if (enabled && !accepted) return reply(false);
	blipManager.enabled = enabled;
	if (!enabled) blipManager.clearBlips();
	updateMenuStore('blips', enabled);
	reply(true);
});
setInterval(() => {
	if (blipManager.enabled && !permissions.has('PLAYER_MONITORING')) {
		blipManager.enabled = false;
		blipManager.clearBlips();
		updateMenuStore('blips', false);
	}
}, 1000);
on('onResourceStop', (name: string) => {
	if (name === GetCurrentResourceName()) blipManager.clearBlips();
});
