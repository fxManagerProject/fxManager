import { useEffect, useState } from 'react';
import { MainPanel } from './components/MainPanel';
import { QuickMenu } from './components/QuickMenu';
import { NoclipControls } from './components/NoclipControls';
import { useNuiEvent } from './hooks/useNuiEvent';
import { useNotificationEvents } from './hooks/useNotificationEvents';
import { NotificationViewport } from './components/notifications';
import { debugData } from './utils/debugData';
import { isEnvBrowser } from './utils/misc';
import { DevTools } from './components/devtools';
import { NUI_PERMISSIONS_EVENT } from '@common/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import { fetchNui } from './utils/fetchNui';
import { useHotkey } from './hooks/useHotKey';
import { useMenuStore } from './store/menustore';
import { useMenuSync } from './hooks/useMenuSync';

type Mode = 'quick' | 'panel' | null;

debugData([
	{
		action: 'visibility',
		data: { tab: 'quick' } as { tab: Mode },
	},
]);

export default function App() {
	const [mode, setMode] = useState<Mode>(null);
	const [permissions, setPermissions] = useState<number>(
		isEnvBrowser() ? UserPermissions.MASTER : 0,
	);

	const noclipEnabled = useMenuStore((state) => state.noclip);

	/** sends the bitfield permission value */
	useNuiEvent<number>(NUI_PERMISSIONS_EVENT, setPermissions);

	useNuiEvent<{ tab: 'quick' | 'panel' | 'none' }>('visibility', ({ tab }) => {
		setMode(tab === 'none' ? null : tab);
	});

	useNotificationEvents();
	useMenuSync();

	useEffect(() => {
		fetchNui('nuiloaded');
	}, []);

	useHotkey('F6', () => fetchNui('nuiToggleMode', { target: 'quick' }));
	useHotkey('F7', () => fetchNui('nuiToggleMode', { target: 'panel' }));
	useHotkey('Escape', () => fetchNui('nuiclose'));

	return (
		<>
			{mode === 'quick' && permissions !== UserPermissions.NONE && (
				<div className="fixed left-6 top-6">
					<QuickMenu
						permissions={permissions}
						onClose={() => {
							setMode(null);
							void fetchNui('nuiclose');
						}}
					/>
				</div>
			)}
			{mode === 'panel' && (
				<MainPanel
					permissions={permissions}
					onClose={() => {
						setMode(null);
						void fetchNui('nuiclose');
					}}
				/>
			)}
			<NoclipControls
				visible={(isEnvBrowser() && mode === 'quick') || noclipEnabled}
			/>
			{/* notifications render on top of everything, menu or panel open or closed */}
			<NotificationViewport />
			{isEnvBrowser() && <DevTools />}
		</>
	);
}
