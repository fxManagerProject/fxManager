import { sleep } from '@common/utils';
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

let isQuickMenuOpen = false;

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
	isQuickMenuOpen = true;

	setImmediate(async () => {
		while (isQuickMenuOpen) {
			// Disable game controls and process inputs
			for (const { control, direction } of NAV_CONTROLS) {
				DisableControlAction(0, control, true);

				if (IsDisabledControlJustPressed(0, control)) {
					sendNav(direction);
				}
			}

			await sleep(0);
		}
	});
}

function stopQuickMenuNavigation() {
	isQuickMenuOpen = false;
}

// Control NUI focus when a dialog is opened/closed from React
NuiCallback('setDialogFocus', (data: { open: boolean }, cb) => {
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
	if (visible) {
		startQuickMenuNavigation();
	} else {
		stopQuickMenuNavigation();
	}
}
