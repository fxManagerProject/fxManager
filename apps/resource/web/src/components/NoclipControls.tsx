interface NoclipControlsProps {
	visible: boolean;
}

const controls = [
	{ key: <p>Space</p>, label: 'Ascend' },
	{ key: <p>Ctrl</p>, label: 'Descend' },
	{ key: <p>Shift</p>, label: 'Move faster' },
	{ key: <p>Mouse Wheel</p>, label: 'Adjust speed' },
];

export function NoclipControls({ visible }: NoclipControlsProps) {
	if (!visible) return null;

	return (
		<div className="fixed bottom-4 right-4 flex items-center gap-3 rounded-lg border-border/95 bg-card/85 px-3 py-2 text-xs shadow-xl select-none">
			{controls.map((control) => {
				const Element = control.key;

				return (
					<div
						key={control.label.toLowerCase()}
						className="flex items-center gap-1.5 whitespace-nowrap"
					>
						<kbd className="border bg-amber-700 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-200">
							{Element}
						</kbd>
						<span className="text-neutral-400">{control.label}</span>
					</div>
				);
			})}
		</div>
	);
}
