import { expect, mock, test } from 'bun:test';
const callbacks = new Map<
	string,
	(data: unknown, reply: (value: unknown) => void) => void
>();
const ticks = new Map<number, () => void>();
let nextTick = 0;
const focuses: boolean[] = [];
mock.module('../../utils/nui-callbacks', () => ({
	NuiCallback: (
		name: string,
		handler: (data: unknown, reply: (value: unknown) => void) => void,
	) => callbacks.set(name, handler),
}));
mock.module('@nativewrappers/fivem', () => ({ Control: {} }));
Object.assign(globalThis, {
	setTick: (handler: () => void) => {
		ticks.set(++nextTick, handler);
		return nextTick;
	},
	clearTick: (id: number) => ticks.delete(id),
	SetNuiFocus: (open: boolean) => focuses.push(open),
	SendNUIMessage: () => {},
});
const { setQuickMenuVisible } = await import('./quickmenu');
test('closing a prompt after switching away never steals panel focus or restarts navigation', () => {
	setQuickMenuVisible(true);
	callbacks.get('setDialogFocus')!({ open: true }, () => {});
	expect(ticks.size).toBe(0);
	setQuickMenuVisible(false);
	focuses.length = 0;
	callbacks.get('setDialogFocus')!({ open: false }, () => {});
	expect(focuses).toEqual([]);
	expect(ticks.size).toBe(0);
});
test('repeated dialog close events create only one navigation tick', () => {
	setQuickMenuVisible(true);
	callbacks.get('setDialogFocus')!({ open: false }, () => {});
	callbacks.get('setDialogFocus')!({ open: false }, () => {});
	expect(ticks.size).toBe(1);
	setQuickMenuVisible(false);
	expect(ticks.size).toBe(0);
});
