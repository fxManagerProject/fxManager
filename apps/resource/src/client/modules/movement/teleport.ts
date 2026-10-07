import { Game, Vector2, Vector3 } from '@nativewrappers/fivem';
import { NuiCallback } from '../../utils/nui-callbacks';
import { sleep } from '../../../common/utils';
import { noclipController } from './noclip';
import { permissions } from '../../utils/permissions';
import { ClientCallbacks } from '../../utils/callbacks';
import { CALLBACK_NAMES } from '@common/types';

class TeleportController {
	private isPlayerTeleporting = false;

	private async validate(): Promise<boolean> {
		if (!permissions.has('TELEPORT')) return false;

		const response = await ClientCallbacks.trigger<boolean>(
			CALLBACK_NAMES.TELEPORT_COORDS,
			null,
			{ fallback: false },
		);

		return response;
	}

	public async teleportToCoords(coords: Vector3): Promise<boolean> {
		if (this.isPlayerTeleporting) return false;
		if (!(await this.validate())) return false;

		this.isPlayerTeleporting = true;
		const ped = Game.PlayerPed;
		const vehicle = ped.CurrentVehicle;
		const isDriver = vehicle?.getPedOnSeat(-1)?.Handle === ped.Handle;
		const entity = isDriver && vehicle ? vehicle : ped;

		try {
			SetFocusPosAndVel(coords.x, coords.y, coords.z, 0, 0, 0);
			RequestCollisionAtCoord(coords.x, coords.y, coords.z);

			while (!HasCollisionLoadedAroundEntity(ped.Handle)) {
				await sleep(0);
			}

			SetEntityCoordsNoOffset(
				entity.Handle,
				...coords.toArray(),
				true,
				true,
				true,
			);
			noclipController.syncPosition(coords);
		} finally {
			ClearFocus();
			setTimeout(() => (this.isPlayerTeleporting = false), 750);
		}

		return true;
	}

	public async findZCoord(coords: Vector2): Promise<number | null> {
		let zPointer = GetHeightmapBottomZForPosition(...coords.toArray());
		let [foundZ, finalZ]: [boolean, number | null] = [false, null];

		do {
			SetFocusPosAndVel(coords.x, coords.y, zPointer, 0, 0, 0);
			[foundZ, finalZ] = GetGroundZFor_3dCoord(coords.x, coords.y, 1000, true);
			zPointer += 50;

			await sleep(10);
		} while (!foundZ && zPointer < 800);

		ClearFocus();

		return finalZ;
	}
}

export const teleportController = new TeleportController();

interface TeleportCoordsNuiRequest {
	x: number;
	y: number;
	z: number;
}

NuiCallback<TeleportCoordsNuiRequest, boolean>(
	'teleport-coords',
	async (data, reply) => {
		// todo: feedback through notif. maybe also return reason?
		const success = await teleportController.teleportToCoords(
			new Vector3(data.x, data.y, data.z),
		);

		reply(success);
	},
);

NuiCallback<null, boolean>('teleport-marker', async (_data, reply) => {
	if (!IsWaypointActive()) return reply(false);

	const blipId = GetFirstBlipInfoId(GetWaypointBlipEnumId());
	const xyCoords = Vector2.fromArray(GetBlipInfoIdCoord(blipId));
	const foundZ = await teleportController.findZCoord(xyCoords);

	if (foundZ === null) return reply(false);

	// todo: feedback through notif. maybe also return reason?
	const coords = new Vector3(xyCoords.x, xyCoords.y, foundZ);
	const success = await teleportController.teleportToCoords(coords);
	reply(success);
});
