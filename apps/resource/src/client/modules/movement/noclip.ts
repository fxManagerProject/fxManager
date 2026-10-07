import { CALLBACK_NAMES } from '@common/types';
import {
	Game,
	Vector3,
	Control,
	GameplayCamera,
	Entity,
	Vehicle,
} from '@nativewrappers/fivem';
import { permissions } from '../../utils/permissions';
import { ClientCallbacks } from '../../utils/callbacks';
import { NuiCallback } from '../../utils/nui-callbacks';

// Explicit key mapping
const MOVE_ASCEND_KEY = Control.Jump; // Space bar
const MOVE_DESCEND_KEY = Control.Duck; // Ctrl or Cover
const CHANGE_SPEED_KEY = Control.Sprint; // Left Shift modifier

const NO_CLIP_NORMAL_SPEED = 0.5;
const NO_CLIP_FAST_SPEED = 2.5;
const BREAK_SPEED = 12.0;
const SPEED_STEPS = [0.5, 1.0, 2.5, 5.0, 7.5];

class NoclipController {
	private isNoClipping = false;
	private tickId: number | null = null;
	private speedIndex = 2;
	private currentPosition: Vector3 | null = null;
	private velocity = new Vector3(0, 0, 0);

	public isEnabled(): boolean {
		return this.isNoClipping;
	}

	public syncPosition(position: Vector3) {
		if (!this.isNoClipping) return;

		this.currentPosition = position;
		this.velocity = new Vector3(0, 0, 0);
	}

	private isControlAlwaysPressed(group: number, control: number): boolean {
		return (
			IsControlPressed(group, control) ||
			IsDisabledControlPressed(group, control)
		);
	}

	private setInvincible(state: boolean, entityHandle: number): void {
		SetEntityInvincible(entityHandle, state);
		SetPlayerInvincible(PlayerId(), state);
	}

	public async toggle(targetState?: boolean): Promise<boolean> {
		const desiredState = targetState ?? !this.isNoClipping;

		if (desiredState && !permissions.has('NOCLIP')) {
			await this.setNoClip(false);
			return false;
		}

		const response = await ClientCallbacks.trigger<{
			allowed: boolean;
			state: boolean;
		}>(
			CALLBACK_NAMES.TOGGLE_NOCLIP,
			{ state: desiredState },
			{ fallback: { allowed: false, state: false } },
		);

		if (response.allowed && response.state) {
			await this.setNoClip(true);
		} else {
			await this.setNoClip(false);
		}

		return this.isNoClipping;
	}

	private async setNoClip(val: boolean): Promise<void> {
		if (this.isNoClipping === val) return;

		const playerPed = Game.PlayerPed;
		let noClippingEntity: Entity = playerPed;

		if (playerPed.isSittingInAnyVehicle()) {
			const veh = playerPed.CurrentVehicle;
			const isDriver = veh && veh.getPedOnSeat(-1)?.Handle === playerPed.Handle;

			if (isDriver) {
				// Driver carries the entire vehicle into noclip
				noClippingEntity = veh;
			} else {
				// Non-drivers leave the vehicle instantly before entering ped noclip
				ClearPedTasksImmediately(playerPed.Handle);
				TaskLeaveVehicle(playerPed.Handle, veh!.Handle, 16); // 16 = Instant leave flag

				// Offset ped slightly above vehicle seat to prevent stuck collision frame
				const currentPos = playerPed.Position;
				SetEntityCoords(
					playerPed.Handle,
					currentPos.x,
					currentPos.y,
					currentPos.z + 1.0,
					true,
					true,
					true,
					false,
				);
			}
		}

		const isVeh = noClippingEntity instanceof Vehicle;
		this.isNoClipping = val;

		if (this.isNoClipping) {
			PlaySoundFromEntity(
				-1,
				'SELECT',
				playerPed.Handle,
				'HUD_LIQUOR_STORE_SOUNDSET',
				false,
				0,
			);
			SetUserRadioControlEnabled(false);

			SetEntityAlpha(noClippingEntity.Handle, 51, false);
			if (!isVeh) {
				ClearPedTasksImmediately(playerPed.Handle);
			}

			this.setInvincible(true, noClippingEntity.Handle);

			this.currentPosition = noClippingEntity.Position;
			this.velocity = new Vector3(0, 0, 0);

			this.tickId = setTick(() => this.onTick(noClippingEntity, isVeh));
		} else {
			PlaySoundFromEntity(
				-1,
				'CANCEL',
				playerPed.Handle,
				'HUD_LIQUOR_STORE_SOUNDSET',
				false,
				0,
			);
			SetUserRadioControlEnabled(true);

			if (this.tickId !== null) {
				clearTick(this.tickId);
				this.tickId = null;
			}

			this.currentPosition = null;

			FreezeEntityPosition(noClippingEntity.Handle, false);
			SetEntityCollision(noClippingEntity.Handle, true, true);
			SetEntityVisible(noClippingEntity.Handle, true, false);
			SetLocalPlayerVisibleLocally(true);
			ResetEntityAlpha(noClippingEntity.Handle);

			SetEveryoneIgnorePlayer(playerPed.Handle, false);
			SetPoliceIgnorePlayer(playerPed.Handle, false);

			this.handleLandedSafety(noClippingEntity, isVeh);
		}
	}

	private onTick(noClippingEntity: Entity, isVeh: boolean): void {
		if (!this.isNoClipping || !noClippingEntity) return;

		const ped = Game.PlayerPed;

		// Disable movement and camera controls so default game physics don't interfere
		Game.disableControlThisFrame(0, Control.MoveLeftOnly);
		Game.disableControlThisFrame(0, Control.MoveRightOnly);
		Game.disableControlThisFrame(0, Control.MoveUpOnly);
		Game.disableControlThisFrame(0, Control.MoveDownOnly);
		Game.disableControlThisFrame(0, Control.Jump);
		Game.disableControlThisFrame(0, Control.Duck);
		Game.disableControlThisFrame(0, Control.VehicleCinCam);
		Game.disableControlThisFrame(0, Control.SelectNextWeapon);
		Game.disableControlThisFrame(0, Control.SelectPrevWeapon);

		FreezeEntityPosition(noClippingEntity.Handle, true);
		SetEntityCollision(noClippingEntity.Handle, false, false);
		SetEntityVisible(noClippingEntity.Handle, false, false);
		SetLocalPlayerVisibleLocally(true);
		SetEntityAlpha(noClippingEntity.Handle, 51, false);

		SetEveryoneIgnorePlayer(ped.Handle, true);
		SetPoliceIgnorePlayer(ped.Handle, true);

		// Speed adjustment via mouse wheel
		if (Game.isDisabledControlJustPressed(0, Control.SelectNextWeapon)) {
			this.speedIndex = Math.min(this.speedIndex + 1, SPEED_STEPS.length - 1);
		} else if (Game.isDisabledControlJustPressed(0, Control.SelectPrevWeapon)) {
			this.speedIndex = Math.max(this.speedIndex - 1, 0);
		}

		// Horizontal WASD polling
		let moveX = 0; // Left / Right
		if (this.isControlAlwaysPressed(0, Control.MoveRightOnly)) moveX += 1;
		if (this.isControlAlwaysPressed(0, Control.MoveLeftOnly)) moveX -= 1;

		let moveY = 0; // Forward / Backward
		if (this.isControlAlwaysPressed(0, Control.MoveDownOnly)) moveY += 1;
		if (this.isControlAlwaysPressed(0, Control.MoveUpOnly)) moveY -= 1;

		// Vertical Ascend / Descend polling
		let moveZ = 0;
		if (this.isControlAlwaysPressed(0, MOVE_ASCEND_KEY)) moveZ += 1;
		if (this.isControlAlwaysPressed(0, MOVE_DESCEND_KEY)) moveZ -= 1;

		const baseSpeed = SPEED_STEPS[this.speedIndex] ?? NO_CLIP_NORMAL_SPEED;
		const isFast = this.isControlAlwaysPressed(0, CHANGE_SPEED_KEY);
		const speedMultiplier = isFast ? NO_CLIP_FAST_SPEED : 1.0;
		const vehicleMultiplier = isVeh ? 2.0 : 1.0;

		const speed = baseSpeed * speedMultiplier * vehicleMultiplier;

		this.moveInNoClip(noClippingEntity, moveX, moveY, moveZ, speed);
	}

	private moveInNoClip(
		entity: Entity,
		inputX: number,
		inputY: number,
		inputZ: number,
		speed: number,
	): void {
		if (!entity) return;

		const camRot = GameplayCamera.Rotation;

		// Freeze tilt (pitch = 0, roll = 0) while applying camera yaw (camRot.z)
		SetEntityRotation(entity.Handle, 0.0, 0.0, camRot.z, 0, false);

		// Pure 2D horizontal heading from camera yaw (Z rotation only)
		const yawRad = (camRot.z * Math.PI) / 180;

		// GTA V world coordinates: Yaw 0 is North (+Y), Yaw 90 is West (-X)
		const forwardVector = new Vector3(-Math.sin(yawRad), Math.cos(yawRad), 0);
		const rightVector = new Vector3(Math.cos(yawRad), Math.sin(yawRad), 0);

		// Combine horizontal displacement
		const targetHorizontal = rightVector
			.multiply(inputX)
			.add(forwardVector.multiply(-inputY))
			.multiply(speed);

		// Z displacement strictly tied to Space (Up) / Ctrl or Duck (Down)
		const targetZ = inputZ * speed;

		const dt = GetFrameTime();
		const lerpFactor = Math.min(dt * BREAK_SPEED, 1.0);

		// Apply linear interpolation for smooth movement
		this.velocity = new Vector3(
			this.velocity.x + (targetHorizontal.x - this.velocity.x) * lerpFactor,
			this.velocity.y + (targetHorizontal.y - this.velocity.y) * lerpFactor,
			this.velocity.z + (targetZ - this.velocity.z) * lerpFactor,
		);

		// Deadzone check to prevent floating point drift
		if (Math.abs(this.velocity.x) < 0.001)
			this.velocity = new Vector3(0, this.velocity.y, this.velocity.z);
		if (Math.abs(this.velocity.y) < 0.001)
			this.velocity = new Vector3(this.velocity.x, 0, this.velocity.z);
		if (Math.abs(this.velocity.z) < 0.001)
			this.velocity = new Vector3(this.velocity.x, this.velocity.y, 0);

		if (!this.currentPosition) {
			this.currentPosition = entity.Position;
		}

		this.currentPosition = this.currentPosition.add(this.velocity);

		SetEntityCoords(
			entity.Handle,
			this.currentPosition.x,
			this.currentPosition.y,
			this.currentPosition.z,
			true,
			true,
			true,
			false,
		);
	}

	private handleLandedSafety(entity: Entity, isVeh: boolean): void {
		if (!entity) return;

		const safetyThread = setTick(() => {
			if (this.isNoClipping) {
				clearTick(safetyThread);
				return;
			}

			if (isVeh) {
				if (IsVehicleOnAllWheels(entity.Handle)) {
					this.setInvincible(false, entity.Handle);
					clearTick(safetyThread);
				}
			} else {
				const ped = entity.Handle;
				if (!IsPedFalling(ped) && !IsPedRagdoll(ped)) {
					this.setInvincible(false, ped);
					clearTick(safetyThread);
				}
			}
		});
	}
}

export const noclipController = new NoclipController();

interface ToggleNoclipNuiRequest {
	state: boolean;
}

NuiCallback<ToggleNoclipNuiRequest, { success: boolean; active: boolean }>(
	'toggle-noclip',
	async (data, reply) => {
		const active = await noclipController.toggle(data.state);
		reply({
			success: true,
			active,
		});
	},
);
