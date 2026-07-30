import { useState, useMemo } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import { Switch } from '@fxmanager/ui/components/switch';
import {
	MapPin,
	Wind,
	Tags,
	Radar,
	HeartPulse,
	Zap,
	Car,
	Wrench,
	Trash2,
	type LucideIcon,
	Server,
	ChevronLeft,
	ChevronRight,
} from 'lucide-react';
import { useRovingFocus } from '~/hooks/useRovingFocus';
import { useNuiEvent } from '~/hooks/useNuiEvent';
import { isEnvBrowser } from '~/utils/misc';

type NavigationDirection = 'up' | 'down' | 'left' | 'right' | 'select' | 'back' | 'reset';

type QuickActionItem =
	| {
			type: 'button';
			key: string;
			group: string;
			label: string;
			icon: LucideIcon;
			variant?: 'default' | 'ghost' | 'destructive';
			onSelect: () => void;
	  }
	| {
			type: 'toggle';
			key: string;
			group: string;
			label: string;
			icon: LucideIcon;
			checked: boolean;
			onChange: (value: boolean) => void;
	  };

export function QuickMenu({ onClose }: { onClose: () => void }) {
	const [noclip, setNoclip] = useState(false);
	const [tags, setTags] = useState(true);
	const [blips, setBlips] = useState(false);

	const items: QuickActionItem[] = [
		{
			type: 'button',
			key: 'teleport',
			group: 'Movement',
			label: 'Teleport to marker',
			icon: MapPin,
			onSelect: () => console.log('teleport to marker'),
		},
		{
			type: 'toggle',
			key: 'noclip',
			group: 'Movement',
			label: 'No-clip / fly mode',
			icon: Wind,
			checked: noclip,
			onChange: setNoclip,
		},
		{
			type: 'toggle',
			key: 'tags',
			group: 'Moderation',
			label: 'Player tags',
			icon: Tags,
			checked: tags,
			onChange: setTags,
		},
		{
			type: 'toggle',
			key: 'blips',
			group: 'Moderation',
			label: 'Player blips',
			icon: Radar,
			checked: blips,
			onChange: setBlips,
		},
		{
			type: 'button',
			key: 'heal',
			group: 'Medical',
			label: 'Heal player',
			icon: HeartPulse,
			onSelect: () => console.log('heal player'),
		},
		{
			type: 'button',
			key: 'heal-all',
			group: 'Medical',
			label: 'Heal all',
			icon: HeartPulse,
			onSelect: () => console.log('heal all'),
		},
		{
			type: 'button',
			key: 'revive',
			group: 'Medical',
			label: 'Revive player',
			icon: Zap,
			onSelect: () => console.log('revive player'),
		},
		{
			type: 'button',
			key: 'revive-all',
			group: 'Medical',
			label: 'Revive all',
			icon: Zap,
			onSelect: () => console.log('revive all'),
		},
		{
			type: 'button',
			key: 'spawn',
			group: 'Vehicle',
			label: 'Spawn vehicle',
			icon: Car,
			onSelect: () => console.log('spawn vehicle'),
		},
		{
			type: 'button',
			key: 'fix',
			group: 'Vehicle',
			label: 'Fix vehicle',
			icon: Wrench,
			onSelect: () => console.log('fix vehicle'),
		},
		{
			type: 'button',
			key: 'delete',
			group: 'Vehicle',
			label: 'Delete vehicle',
			icon: Trash2,
			variant: 'destructive',
			onSelect: () => console.log('delete vehicle'),
		},
	];

	const groups = useMemo(() => Array.from(new Set(items.map((i) => i.group))), [items]);
	const [activeGroupIndex, setActiveGroupIndex] = useState(0);
	const activeGroup = groups[activeGroupIndex];

	const activeItems = useMemo(
		() => items.filter((i) => i.group === activeGroup),
		[items, activeGroup]
	);

	const nextGroup = () => setActiveGroupIndex((prev) => (prev + 1) % groups.length);
	const prevGroup = () => setActiveGroupIndex((prev) => (prev - 1 + groups.length) % groups.length);

	const {
		activeIndex,
		moveUp,
		moveDown,
		moveLeft,
		moveRight,
		activateCurrent,
		resetFocus,
	} = useRovingFocus({
		itemCount: activeItems.length,
		onActivate: (index) => {
			const item = activeItems[index];
			if (!item) return;
			if (item.type === 'button') item.onSelect();
			if (item.type === 'toggle') item.onChange(!item.checked);
		},
		onNextCategory: nextGroup,
		onPrevCategory: prevGroup,
	});

	// Listen for native NUI messages sent from client JS Scrt
	useNuiEvent<NavigationDirection>('navigate', (direction) => {
		switch (direction) {
			case 'up':
				moveUp();
				break;
			case 'down':
				moveDown();
				break;
			case 'left':
				moveLeft();
				break;
			case 'right':
				moveRight();
				break;
			case 'select':
				activateCurrent();
				break;
			case 'reset':
				resetFocus();
				break;
			case 'back':
				onClose();
				break;
		}
	});

	return (
		<div
			role="menu"
			aria-label="Quick actions"
			className="w-72 rounded-lg border bg-card/95 text-card-foreground shadow-2xl backdrop-blur-md overflow-hidden"
		>
			<header className="flex items-center justify-between gap-2 px-3 py-2 border-b">
				<div className="flex items-center gap-2">
					<div className="flex aspect-square size-6 items-center justify-center rounded bg-primary text-primary-foreground">
						<Server className="h-3.5 w-3.5" />
					</div>
					<span className="text-md font-bold">
						<span className="text-primary">fx</span>Manager
					</span>
				</div>
				{isEnvBrowser() ? (
					<span className="text-[10px] text-muted-foreground bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20">
						DEV BROWSER
					</span>
				) : (
					<kbd className="text-[10px] text-muted-foreground px-1.5 py-0.5">
						F6
					</kbd>
				)}
			</header>

			<div
				className={`flex items-center justify-between border-b px-2.5 py-1.5 text-xs transition-colors ${
					activeIndex === -1
						? 'bg-primary text-primary-foreground font-bold'
						: 'bg-muted/40 text-muted-foreground'
				}`}
			>
				<ChevronLeft className="h-4 w-4" />
				<span className="tracking-wider uppercase text-[11px]">
					{activeGroup}
				</span>
				<ChevronRight className="h-4 w-4" />
			</div>

			<div className="p-1.5 flex flex-col gap-1 min-h-[160px]">
				{activeItems.map((item, index) => {
					const isFocused = activeIndex === index;

					return (
						<div key={item.key}>
							{item.type === 'toggle' ? (
								<div
									className={`flex items-center justify-between rounded px-2.5 py-2 text-xs transition-colors ${
										isFocused
											? 'bg-primary text-primary-foreground font-semibold'
											: 'text-foreground hover:bg-muted/50'
									}`}
								>
									<div className="flex items-center gap-2">
										<item.icon className={`h-4 w-4 ${isFocused ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
										<span>{item.label}</span>
									</div>
									<Switch
										checked={item.checked}
										onCheckedChange={item.onChange}
										tabIndex={-1}
									/>
								</div>
							) : (
								<Button
									variant={isFocused ? 'default' : (item.variant ?? 'ghost')}
									size="sm"
									className={`w-full justify-start gap-2 text-xs h-9 ${
										isFocused ? 'bg-primary text-primary-foreground shadow' : ''
									}`}
								>
									<item.icon className="h-4 w-4" />
									{item.label}
								</Button>
							)}
						</div>
					);
				})}
			</div>

			<footer className="flex items-center justify-between border-t px-3 py-1.5 text-[10px] text-muted-foreground bg-muted/20">
				<span><kbd className="font-mono">↑</kbd> Category Bar</span>
				<span><kbd className="font-mono">← →</kbd> Switch Tab</span>
			</footer>
		</div>
	);
}
