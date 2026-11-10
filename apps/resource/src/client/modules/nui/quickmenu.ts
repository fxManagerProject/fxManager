import { NuiCallback } from '../../utils/nui-callbacks';
import { Control } from '@nativewrappers/fivem';

type NavigationDirection =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'select'
	| 'back'
	| 'reset';

let navigationTick: number | null = null;
let isQuickMenuVisible = false;

// Controls to disable while navigating without NUI focus
const NAV_CONTROLS = [
	{ control: Control.FrontendUp, direction: 'up' as const },
	{ control: Control.FrontendDown, direction: 'down' as const },
	{ control: Control.FrontendLeft, direction: 'left' as const },
	{ control: Control.FrontendRight, direction: 'right' as const },
	{ control: Control.FrontendAccept, direction: 'select' as const },
	{ control: Control.FrontendCancel, direction: 'back' as const },
];

function sendNav(direction: NavigationDirection) {
	SendNUIMessage({
		action: 'navigate',
		data: direction,
	});
}

function startQuickMenuNavigation() {
	if (navigationTick !== null) return;
	navigationTick = setTick(() => {
		for (const { control, direction } of NAV_CONTROLS) {
			DisableControlAction(0, control, true);
			if (IsDisabledControlJustReleased(0, control)) sendNav(direction);
		}
	});
}

function stopQuickMenuNavigation() {
	if (navigationTick === null) return;
	clearTick(navigationTick);
	navigationTick = null;
}

// Control NUI focus when a dialog is opened/closed from React
NuiCallback('setDialogFocus', (data: { open: boolean }, cb) => {
	if (!isQuickMenuVisible || !data || typeof data.open !== 'boolean')
		return cb({});
	if (data.open) {
		stopQuickMenuNavigation();
		SetNuiFocus(true, true);
	} else {
		SetNuiFocus(false, false);
		startQuickMenuNavigation();
	}
	cb({});
});

// Sync menu visibility state from your main controller
export function setQuickMenuVisible(visible: boolean) {
	isQuickMenuVisible = visible;
	if (visible) {
		startQuickMenuNavigation();
	} else {
		stopQuickMenuNavigation();
	}
}

/** Used to update the F6/Quickmenu indicators for active features */
export function updateMenuStore(
	key: 'no-clip' | 'tags' | 'blips',
	state: boolean,
) {
	SendNUIMessage({
		action: 'menustore-update',
		data: {
			key,
			state,
		},
	});
}
