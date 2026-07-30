import React, { useState } from 'react';
import { Wrench } from 'lucide-react';
import { useHotkey } from '~/hooks/useHotKey';
import { debugData } from '~/utils/debugData';

type Mode = 'quick' | 'panel' | null;

export const DevTools: React.FC = () => {
	const [isOpen, setIsOpen] = useState(false);

	const sendVisibilityEvent = (tab: Mode) => {
		debugData([
			{
				action: 'visibility',
				data: { tab } as { tab: Mode },
			},
		]);
	};

	useHotkey('F6', () => {
		sendVisibilityEvent('quick');
	}, { });
	useHotkey('F7', () => {
		sendVisibilityEvent('panel');
	}, { });
	useHotkey('D', () => {
		setIsOpen(prev => !prev);
	}, { alt: true, shift: true });

	return (
		<div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 font-sans select-none">
			{/* Expanded Quick Action Menu */}
			{isOpen && (
				<div className="flex flex-col gap-1.5 p-2 bg-zinc-900/95 border border-zinc-800 text-zinc-100 rounded-lg shadow-xl text-xs min-w-[140px] backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-150">
					<div className="px-2 py-1 font-semibold text-zinc-400 border-b border-zinc-800 flex justify-between items-center space-x-3">
						<span>DEV ACTIONS</span>
						<span className="text-[10px] text-zinc-500">Ctrl+Shift+D</span>
					</div>

					<button
						onClick={() => sendVisibilityEvent('quick')}
						className="px-2.5 py-1.5 rounded text-left hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-between"
					>
						<span>Open Quick Tab</span>
						<span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded">Quick</span>
					</button>

					<button
						onClick={() => sendVisibilityEvent('panel')}
						className="px-2.5 py-1.5 rounded text-left hover:bg-zinc-800 hover:text-white transition-colors flex items-center justify-between"
					>
						<span>Open Panel</span>
						<span className="text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded">Panel</span>
					</button>

					<button
						onClick={() => sendVisibilityEvent(null)}
						className="px-2.5 py-1.5 rounded text-left hover:bg-red-950/50 text-red-400 hover:text-red-300 transition-colors"
					>
						Close / Hide (null)
					</button>
				</div>
			)}

			<button
				onClick={() => setIsOpen((prev) => !prev)}
				title="Toggle Dev Menu (Ctrl+Shift+D)"
				className={`flex items-center justify-center w-10 h-10 rounded-full shadow-lg border transition-all duration-200 ${
					isOpen
						? 'bg-primary text-white scale-105'
						: 'bg-secondary text-zinc-300 hover:text-white hover:border-zinc-500 hover:scale-105'
				}`}
			>
				<Wrench />
			</button>
		</div>
	);
};
