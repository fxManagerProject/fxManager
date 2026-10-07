import { useEffect, useState } from 'react';
import { MainPanel } from './components/MainPanel';
import { QuickMenu } from './components/QuickMenu';
import { NoclipControls } from './components/NoclipControls';
import { useNuiEvent } from './hooks/useNuiEvent';
import { debugData } from './utils/debugData';
import { isEnvBrowser } from './utils/misc';
import { DevTools } from './components/devtools';
import { NUI_PERMISSIONS_EVENT } from '@common/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import { fetchNui } from './utils/fetchNui';
import { useHotkey } from './hooks/useHotKey';

type Mode = 'quick' | 'panel' | null;

debugData([
	{
		action: 'visibility',
		data: { tab: 'quick' } as { tab: Mode },
	},
]);

export default function App() {
	const [mode, setMode] = useState<Mode>(null);
	const [noclipEnabled, setNoclipEnabled] = useState(false);
	const [permissions, setPermissions] = useState<number>(
		isEnvBrowser() ? UserPermissions.MASTER : 0,
	);

	/** sends the bitfield permission value */
	useNuiEvent<number>(NUI_PERMISSIONS_EVENT, setPermissions);

	useNuiEvent<{ tab: 'quick' | 'panel' }>('visibility', ({ tab }) => {
		setMode((m) => (m === tab ? null : tab));
	});

	useEffect(() => {
		fetchNui('nuiloaded');
	}, []);

	useHotkey('F6', () => fetchNui('nuiToggleMode', { target: 'quick' }));
	useHotkey('F7', () => fetchNui('nuiToggleMode', { target: 'panel' }));
	useHotkey('Escape', () => fetchNui('nuiclose'));

	// Use to restrict access, i.e. unprivileged users can only
	// access reports section
	if (permissions === UserPermissions.NONE) return null;

	return (
		<>
			{mode === 'quick' && (
				<div className="fixed left-6 top-6">
					<QuickMenu
						permissions={permissions}
						onClose={() => setMode(null)}
						onNoclipChange={setNoclipEnabled}
					/>
				</div>
			)}
			{mode === 'panel' && (
				<MainPanel permissions={permissions} onClose={() => setMode(null)} />
			)}
			<NoclipControls visible={isEnvBrowser() || noclipEnabled} />
			{isEnvBrowser() && <DevTools />}
		</>
	);
}
