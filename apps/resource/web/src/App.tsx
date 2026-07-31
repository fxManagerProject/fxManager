import { useState } from 'react';
import { MainPanel } from './components/MainPanel';
import type { Permissions } from './lib/access';
import { QuickMenu } from './components/QuickMenu';
import { useNuiEvent } from './hooks/useNuiEvent';
import { debugData } from './utils/debugData';
import { isEnvBrowser } from './utils/misc';
import { DevTools } from './components/devtools';

type Mode = 'quick' | 'panel' | null;

debugData([
	{
		action: 'visibility',
		data: { tab: 'quick' } as { tab: Mode },
	},
]);

export default function App() {
	const [mode, setMode] = useState<Mode>(null);
	const [permissions] = useState<Permissions>(['MASTER']);

	useNuiEvent<{ tab: 'quick' | 'panel' }>('visibility', ({ tab }) => {
		setMode((m) => (m === tab ? null : tab));
	});

	return (
		<>
			{mode === 'quick' && (
				<div className="fixed left-6 top-6">
					<QuickMenu onClose={() => setMode(null)} />
				</div>
			)}
			{mode === 'panel' && (
				<MainPanel role={permissions} onClose={() => setMode(null)} />
			)}
			{isEnvBrowser() && <DevTools />}
		</>
	);
}
