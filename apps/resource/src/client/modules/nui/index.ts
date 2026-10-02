import { NuiCallback } from '../../utils/nui-callbacks';
import { permissions } from '../../utils/permissions';
import { setQuickMenuVisible } from './quickmenu';

enum UIState {
	Closed,
	QuickMenu,
	MainPanel,
}

let uiOpen: UIState = UIState.Closed;

function setUIState(newState: UIState) {
	switch (newState) {
		case UIState.Closed:
			SetNuiFocus(false, false);
			SendNUIMessage({ action: 'visibility', data: { tab: 'none' } });

			if (uiOpen === UIState.QuickMenu)
				setQuickMenuVisible(false);

			uiOpen = UIState.Closed;
			break;

		case UIState.QuickMenu:
			SetNuiFocus(false, false);
			SendNUIMessage({ action: 'visibility', data: { tab: 'quick' } });
			setQuickMenuVisible(true);
			uiOpen = UIState.QuickMenu;
			break;

		case UIState.MainPanel:
			SetNuiFocus(true, true);
			SendNUIMessage({ action: 'visibility', data: { tab: 'panel' } });
			uiOpen = UIState.MainPanel;
			break;
	}
}

NuiCallback('nuiclose', (_, cb) => {
	setUIState(UIState.Closed);
	cb({});
});

NuiCallback('nuiToggleMode', (data: { target: 'quick' | 'panel' }, cb) => {
	const targetState = data.target === 'quick' ? UIState.QuickMenu : UIState.MainPanel;

	if (uiOpen === targetState) {
		setUIState(UIState.Closed);
	} else {
		setUIState(targetState);
	}
	cb({});
});

RegisterCommand('fx-quickmenu', () => {
	if (permissions.getPermissions() === 0) return;
	setUIState(uiOpen === UIState.QuickMenu ? UIState.Closed : UIState.QuickMenu);
}, false);

RegisterCommand('fx-mainpanel', () => {
	if (permissions.getPermissions() === 0) return;
	setUIState(uiOpen === UIState.MainPanel ? UIState.Closed : UIState.MainPanel);
}, false);

RegisterKeyMapping('fx-quickmenu', 'Open fxManager quick menu', 'keyboard', 'F6');
RegisterKeyMapping('fx-mainpanel', 'Open fxManager panel', 'keyboard', 'F7');
