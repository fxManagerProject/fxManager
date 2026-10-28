import { expect, mock, test } from 'bun:test';
let toggle: (enabled: boolean, reply: (value: boolean) => void) => void;
let tick: () => void;
let allowed = true;
let ped = 20;
const removed: number[] = [];
let handle = 0;
mock.module('../../utils/nui-callbacks', () => ({
	NuiCallback: (name: string, handler: typeof toggle) => {
		if (name === 'moderation-tags') toggle = handler;
	},
}));
mock.module('../../utils/permissions', () => ({
	permissions: { has: () => allowed },
}));
mock.module('../nui/quickmenu', () => ({ updateMenuStore: () => {} }));
const originalInterval = globalThis.setInterval;
Object.assign(globalThis, {
	setInterval: (handler: () => void) => {
		tick = handler;
	},
	on: () => {},
	PlayerPedId: () => 10,
	GetEntityCoords: () => [0, 0, 0],
	GetActivePlayers: () => [0, 1],
	PlayerId: () => 0,
	GetPlayerPed: () => ped,
	DoesEntityExist: () => true,
	GetPlayerServerId: () => 2,
	GetPlayerName: () => 'Player',
	CreateFakeMpGamerTag: () => ++handle,
	RemoveMpGamerTag: (id: number) => removed.push(id),
	NetworkIsPlayerTalking: () => true,
	SetMpGamerTagVisibility: () => {},
	SetMpGamerTagName: () => {},
	GetPedArmour: () => 50,
	SetMpGamerTagAlpha: () => {},
	SetMpGamerTagHealthBarColour: () => {},
	SendNUIMessage: () => {},
});
await import('./tags');
globalThis.setInterval = originalInterval;
test('tags follow ped replacements and are removed on permission revocation', () => {
	toggle!(true, () => {});
	tick!();
	expect(handle).toBe(1);
	ped = 21;
	tick!();
	expect(handle).toBe(2);
	expect(removed).toEqual([1]);
	allowed = false;
	tick!();
	expect(removed).toEqual([1, 2]);
});
