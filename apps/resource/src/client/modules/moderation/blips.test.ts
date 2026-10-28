import { expect, mock, test } from 'bun:test';
const removed: number[] = [];
const sprites: number[] = [];
let handle = 0;
mock.module('../../utils/nui-callbacks', () => ({ NuiCallback: () => {} }));
mock.module('../../utils/permissions', () => ({
	permissions: { has: () => true },
}));
mock.module('../../utils/callbacks', () => ({ ClientCallbacks: {} }));
mock.module('../nui/quickmenu', () => ({ updateMenuStore: () => {} }));
Object.assign(globalThis, {
	onNet: () => {},
	on: () => {},
	PlayerId: () => 0,
	GetPlayerServerId: () => 1,
	AddBlipForCoord: () => ++handle,
	RemoveBlip: (id: number) => removed.push(id),
	DoesBlipExist: () => true,
	SetBlipSprite: (_id: number, sprite: number) => sprites.push(sprite),
});
for (const name of [
	'SetBlipScale',
	'SetBlipCategory',
	'SetBlipCoords',
	'SetBlipColour',
	'SetBlipRotation',
	'ShowHeadingIndicatorOnBlip',
	'BeginTextCommandSetBlipName',
	'AddTextComponentSubstringPlayerName',
	'EndTextCommandSetBlipName',
])
	Object.assign(globalThis, { [name]: () => {} });
const { blipManager } = await import('./blips');
test('vehicle and dead states update, disconnected players and disabled blips are removed', () => {
	blipManager.enabled = true;
	blipManager.syncBlips({
		'2': { username: 'Player', coords: [1, 2, 3], inVehicle: true },
	});
	expect(sprites.at(-1)).toBe(225);
	blipManager.syncBlips({
		'2': { username: 'Player', coords: [1, 2, 3], dead: true },
	});
	expect(sprites.at(-1)).toBe(274);
	blipManager.syncBlips({});
	expect(removed).toEqual([1]);
	blipManager.syncBlips({ '3': { username: 'Other', coords: [1, 2, 3] } });
	blipManager.clearBlips();
	expect(removed).toEqual([1, 2]);
});
