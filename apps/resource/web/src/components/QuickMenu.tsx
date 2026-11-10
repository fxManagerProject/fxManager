import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Button } from '@fxmanager/ui/components/button';
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
import { fetchNui } from '~/utils/fetchNui';
import { PromptDialog, type PromptDialogProps } from './DialogPrompt';
import { isEnvBrowser } from '~/utils/misc';
import { UserPermissions } from '@fxmanager/shared/constants';
import { showNotification } from '~/store/notifications';
import { useMenuStore } from '~/store/menustore';

type NavigationDirection =
	| 'up'
	| 'down'
	| 'left'
	| 'right'
	| 'select'
	| 'back'
	| 'reset';

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

type DialogConfig = Omit<PromptDialogProps, 'isOpen' | 'onClose'>;

interface QuickMenuProps {
	onClose: () => void;
	permissions: number;
}

export function QuickMenu({ onClose, permissions }: QuickMenuProps) {
	if (permissions === UserPermissions.NONE) return null;

	const [activeDialog, setActiveDialogState] = useState<DialogConfig | null>(
		null,
	);
	const { noclip, tags, blips, setNoclip, setTags, setBlips } = useMenuStore();

	// Helper function that updates local dialog state and syncs NUI focus with client
	const setActiveDialog = useCallback((config: DialogConfig | null) => {
		setActiveDialogState(config);
		fetchNui('setDialogFocus', { open: config !== null }).catch(() => {});
	}, []);

	// Cleanup effect: Ensure NUI focus is released if QuickMenu unmounts while a dialog is open
	const activeDialogRef = useRef(activeDialog);
	activeDialogRef.current = activeDialog;

	useEffect(() => {
		return () => {
			if (activeDialogRef.current !== null) {
				fetchNui('setDialogFocus', { open: false }).catch(() => {});
			}
		};
	}, []);

	const handleNoclipToggle = useCallback((targetState: boolean) => {
		if (isEnvBrowser()) return setNoclip(targetState);

		fetchNui<{ success: boolean; active: boolean }>(
			'toggle-noclip',
			{
				state: targetState,
			},
			{ data: { success: true, active: targetState }, delay: 50 },
		);
	}, []);

	const handleTeleportToCoords = useCallback((coordsString: string) => {
		const [x, y, z] = coordsString.split(',').map((c) => parseFloat(c));

		fetchNui('teleport-coords', { x, y, z });
	}, []);

	const handleTeleportToMarker = useCallback(() => {
		fetchNui('teleport-marker');
	}, []);

	const [monitoringPending, setMonitoringPending] = useState(false);
	async function toggleMonitoring(kind: 'tags' | 'blips', next: boolean) {
		if (monitoringPending) return;
		setMonitoringPending(true);
		try {
			const accepted = await fetchNui<boolean>(`moderation-${kind}`, next, {
				data: true,
			});
			if (!accepted)
				throw new Error('Permission denied or server unavailable.');
			if (kind === 'tags') setTags(next);
			else setBlips(next);
			showNotification({
				title: `Player ${kind} ${next ? 'enabled' : 'disabled'}`,
				variant: 'info',
				duration: 3000,
			});
		} catch (error) {
			showNotification({
				title: 'Unable to change monitoring',
				description: error instanceof Error ? error.message : 'Request failed.',
				variant: 'error',
			});
		} finally {
			setMonitoringPending(false);
		}
	}

	const items: QuickActionItem[] = [
		{
			type: 'button',
			key: 'teleport_marker',
			group: 'Movement',
			label: 'Teleport to marker',
			icon: MapPin,
			onSelect: handleTeleportToMarker,
		},
		{
			type: 'button',
			key: 'teleport_coords',
			group: 'Movement',
			label: 'Teleport to coordinates',
			icon: MapPin,
			onSelect: () => {
				setActiveDialog({
					title: 'Teleport to Coordinates',
					description: 'Enter world coordinates in X, Y, Z format.',
					placeholder: '0.0, 0.0, 70.0',
					// Regex for comma-separated numbers (floats or integers)
					pattern:
						/^\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)\s*$/,
					errorMessage: 'Format must be X, Y, Z (e.g., 215.1, -810.4, 30.7)',
					presets: [
						{ label: 'Legion Square', value: '215.1, -810.4, 30.7' },
						{ label: 'LS Airport', value: '-1037.6, -2737.8, 13.8' },
						{ label: 'Sandy Shores', value: '1850.1, 3686.2, 33.8' },
					],
					onConfirm: (coords) => {
						handleTeleportToCoords(coords);
						showNotification({
							title: 'Teleported',
							description: `To: ${coords}`,
							variant: 'success',
						});
					},
				});
			},
		},
		{
			type: 'toggle',
			key: 'noclip',
			group: 'Movement',
			label: 'No-clip / fly mode',
			icon: Wind,
			checked: noclip,
			onChange: handleNoclipToggle,
		},
		{
			type: 'toggle',
			key: 'tags',
			group: 'Moderation',
			label: 'Player tags',
			icon: Tags,
			checked: tags,
			onChange: (next) => {
				void toggleMonitoring('tags', next);
			},
		},
		{
			type: 'toggle',
			key: 'blips',
			group: 'Moderation',
			label: 'Player blips',
			icon: Radar,
			checked: blips,
			onChange: (next) => {
				void toggleMonitoring('blips', next);
			},
		},
		{
			type: 'button',
			key: 'heal_self',
			group: 'Medical',
			label: 'Heal self',
			icon: HeartPulse,
			onSelect: () =>
				fetchNui<{ success: boolean; message: string }>('heal-target', {
					target: 'self',
				}).then(({ success, message }) => {
					if (!success)
						showNotification({
							title: 'Unable to heal self',
							description: message,
							variant: 'error',
						});
					else
						showNotification({
							title: message,
							variant: 'success',
						});
				}),
		},
		{
			type: 'button',
			key: 'heal_other',
			group: 'Medical',
			label: 'Heal player',
			icon: Zap,
			onSelect: () => {
				setActiveDialog({
					title: 'Heal Player',
					description: 'Enter the target player Server ID.',
					placeholder: 'Server ID (e.g. 12)',
					// Regex for numeric Server IDs
					pattern: /^\d+$/,
					errorMessage: 'Must be a valid numeric Server ID',
					onConfirm: (rawServerId) => {
						const serverId = parseInt(rawServerId, 10);

						if (!serverId || serverId < 1) {
							return showNotification({
								title: 'Invalid server id',
								description: 'Server IDs are positive integers',
								variant: 'error',
							});
						}

						fetchNui<{ success: boolean; message: string }>('heal-target', {
							target: serverId,
						}).then(({ success, message }) => {
							if (!success)
								showNotification({
									title: 'Unable to heal player',
									description: message,
									variant: 'error',
								});
							else
								showNotification({
									title: message,
									variant: 'success',
								});
						});
					},
				});
			},
		},
		{
			type: 'button',
			key: 'heal-all',
			group: 'Medical',
			label: 'Heal all',
			icon: HeartPulse,
			onSelect: () =>
				fetchNui<{ success: boolean; message: string }>('heal-target', {
					target: 'all',
				}).then(({ success, message }) => {
					if (!success)
						showNotification({
							title: 'Unable to heal all',
							description: message,
							variant: 'error',
						});
					else
						showNotification({
							title: message,
							variant: 'success',
						});
				}),
		},
		{
			type: 'button',
			key: 'spawn',
			group: 'Vehicle',
			label: 'Spawn vehicle',
			icon: Car,
			onSelect: () => {
				setActiveDialog({
					title: 'Spawn Vehicle',
					description: 'Enter a valid vehicle spawn model name.',
					placeholder: 'e.g. adder, t20, sultan',
					// Regex for alphanumeric + underscore model names
					pattern: /^[a-zA-Z0-9_]+$/,
					errorMessage:
						'Model name can only contain letters, numbers, and underscores',
					presets: [
						{ label: 'Sultan', value: 'sultan' },
						{ label: 'Adder', value: 'adder' },
						{ label: 'Police Car', value: 'police' },
					],
					confirmLabel: 'Spawn',
					onConfirm: (model) => {
						fetchNui<{ success: boolean; message?: string }>('spawn-vehicle', {
							model: model.toLowerCase(),
						}).then(({ success, message }) => {
							if (!success)
								showNotification({
									title: 'Unable to spawn vehicle',
									description: message,
									variant: 'error',
								});
							else
								showNotification({
									title: message ?? 'Vehicle spawned',
									description: model,
									variant: 'success',
								});
						});
					},
				});
			},
		},
		{
			type: 'button',
			key: 'fix',
			group: 'Vehicle',
			label: 'Fix vehicle',
			icon: Wrench,
			onSelect: () =>
				fetchNui<{ success: boolean; message?: string }>(
					'fix-vehicle',
					null,
				).then(({ success, message }) => {
					if (!success)
						showNotification({
							title: 'Unable to fix vehicle',
							description: message,
							variant: 'error',
						});
					else
						showNotification({
							title: message ?? 'Vehicle repaired',
							variant: 'success',
						});
				}),
		},
		{
			type: 'button',
			key: 'delete',
			group: 'Vehicle',
			label: 'Delete vehicle',
			icon: Trash2,
			variant: 'destructive',
			onSelect: () =>
				fetchNui<{ success: boolean; message?: string }>(
					'delete-vehicle',
					null,
				).then(({ success, message }) => {
					if (!success)
						showNotification({
							title: 'Unable to delete vehicle',
							description: message,
							variant: 'error',
						});
					else
						showNotification({
							title: message ?? 'Vehicle deleted',
							variant: 'warning',
						});
				}),
		},
	];

	const groups = useMemo(
		() => Array.from(new Set(items.map((i) => i.group))),
		[items],
	);

	const [activeGroup] = useMenuStore((state) => state.item);

	const activeItems = useMemo(
		() => items.filter((i) => i.group === activeGroup),
		[items, activeGroup],
	);

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
		groups,
		disabled: activeDialog !== null,
		onActivate: (index) => {
			const item = activeItems[index];
			if (!item) return;
			if (item.type === 'button') item.onSelect();
			if (item.type === 'toggle') item.onChange(!item.checked);
		},
	});

	useNuiEvent<NavigationDirection>('navigate', (direction) => {
		if (activeDialog) return;

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
		<>
			<div
				role="menu"
				aria-label="Quick actions"
				className="w-72 rounded-lg border bg-card/95 text-card-foreground shadow-2xl overflow-hidden"
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

				<div className="p-1.5 flex flex-col min-h-[160px]">
					{activeItems.map((item, index) => {
						const isFocused = activeIndex === index;

						return (
							<div key={item.key}>
								{item.type === 'toggle' ? (
									<button
										type="button"
										role="menuitemcheckbox"
										aria-checked={item.checked}
										onClick={() => item.onChange(!item.checked)}
										disabled={
											monitoringPending &&
											(item.key === 'tags' || item.key === 'blips')
										}
										className={`flex w-full items-center justify-between rounded px-2.5 py-2 text-xs transition-colors ${
											isFocused
												? 'bg-primary text-primary-foreground font-semibold'
												: 'text-foreground hover:bg-muted/50'
										}`}
									>
										<div className="flex items-center gap-2">
											<item.icon
												className={`h-4 w-4 ${isFocused ? 'text-primary-foreground' : 'text-muted-foreground'}`}
											/>
											<span>{item.label}</span>
										</div>

										<div
											className={`flex h-4 w-4 items-center justify-center rounded-full transition-colors ${
												isFocused ? 'bg-black/65' : 'bg-muted-foreground/25'
											}`}
										>
											{item.checked && (
												<div className="h-2 w-2 rounded-full bg-primary" />
											)}
										</div>
									</button>
								) : (
									<Button
										onClick={item.onSelect}
										variant={isFocused ? 'default' : (item.variant ?? 'ghost')}
										size="sm"
										className={`w-full justify-start gap-2 text-xs h-9 ${
											isFocused
												? 'bg-primary text-primary-foreground shadow'
												: ''
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
					<span>
						<kbd className="font-mono">↑</kbd> Category Bar
					</span>
					<span>
						<kbd className="font-mono">← →</kbd> Switch Tab
					</span>
				</footer>
			</div>

			{activeDialog && (
				<PromptDialog
					isOpen={Boolean(activeDialog)}
					{...activeDialog}
					onClose={() => setActiveDialog(null)}
				/>
			)}
		</>
	);
}
