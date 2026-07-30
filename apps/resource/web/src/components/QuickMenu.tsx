import { useState } from 'react';
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
} from 'lucide-react';
import { useRovingFocus } from '~/hooks/useRovingFocus';

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

	// Flat, ordered list of every interactive control in the menu.
	// Order here is the order arrow-key navigation follows.
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

	const { getItemProps } = useRovingFocus({
		itemCount: items.length,
		onActivate: (index) => {
			const item = items[index];
			if (item.type === 'button') item.onSelect();
			if (item.type === 'toggle') item.onChange(!item.checked);
		},
	});

	let lastGroup = '';

	return (
		<div
			role="menu"
			aria-label="Quick actions"
			className="w-72 rounded-md border bg-card text-card-foreground shadow-sm"
			onKeyDown={(e) => {
				if (e.key === 'Escape') onClose();
			}}
		>
			<header className="flex items-center justify-between gap-2 px-4 py-3 border-b">
				<div
					className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground"
				>
					<Server />
				</div>
				<div className="grid flex-1 text-left text-sm leading-tight">
					<span className="text-base font-bold">
						<span className="text-primary">fx</span>Manager Panel
					</span>
				</div>
				<kbd className="text-xs text-muted-foreground">F6</kbd>
			</header>

			<div className="p-2 flex flex-col gap-1">
				{items.map((item, index) => {
					const showGroupLabel = item.group !== lastGroup;
					lastGroup = item.group;
					const itemProps = getItemProps(index);

					return (
						<div key={item.key}>
							{showGroupLabel && (
								<p className="px-2 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
									{item.group}
								</p>
							)}
							{item.type === 'toggle' ? (
								<div className="flex items-center justify-between rounded-sm px-2 py-1.5 text-sm">
									<div className="flex items-center gap-2">
										<item.icon className="h-4 w-4 text-muted-foreground" />
										{item.label}
									</div>
									<Switch
										checked={item.checked}
										onCheckedChange={item.onChange}
										{...itemProps}
									/>
								</div>
							) : (
								<Button
									variant={item.variant ?? 'ghost'}
									className="w-full justify-start gap-2"
									onClick={item.onSelect}
									{...itemProps}
								>
									<item.icon className="h-4 w-4" />
									{item.label}
								</Button>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
