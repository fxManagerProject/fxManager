import { useState } from 'react';
import { Plus, Trash2, ArrowLeft, CircleHelp } from 'lucide-react';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { Button } from '@fxmanager/ui/components/button';
import type { SetupFormData } from './types';
import type { AdminGroupForm } from '@fxmanager/shared/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionGrid } from '../settings/components/permissiongrid';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import { IconPicker } from '@fxmanager/ui/components/icon-selectmenu';
import { getIconComponent } from '@fxmanager/ui/lib/icons';

interface PermissionsStepProps {
	formData: SetupFormData;
	loading: boolean;
	onAddGroup: (group: AdminGroupForm) => void;
	onRemoveGroup: (index: number) => void;
	onBack: () => void;
	onSubmit: () => void;
}

export function PermissionsStep({
	formData,
	loading,
	onAddGroup,
	onRemoveGroup,
	onBack,
	onSubmit,
}: PermissionsStepProps) {
	const [newGroup, setNewGroup] = useState<AdminGroupForm & { icon: string }>({
		name: '',
		colour: '#3b82f6',
		icon: 'Shield',
		permissions: 0,
	});

	function handleAdd() {
		if (!newGroup.name.trim()) return;
		onAddGroup(newGroup);
		setNewGroup({
			name: '',
			colour: '#3b82f6',
			icon: 'Shield',
			permissions: 0,
		});
	}

	return (
		<div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start py-2">
			<div className="xl:col-span-9 flex flex-col gap-4 border p-6 bg-card rounded-xl shadow-xs min-w-0">
				<div className="border-b pb-3">
					<h3 className="text-base font-semibold">
						System-Wide Permission Configuration Matrix
					</h3>
					<p className="text-xs text-muted-foreground">
						Configure global application groups without page stretching.
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-muted/30 p-4 rounded-lg">
					<div className="flex flex-col gap-1.5">
						<Label className="text-xs">Group Identifier/Label</Label>
						<Input
							placeholder="e.g. Lead Moderator"
							value={newGroup.name}
							onChange={(e) =>
								setNewGroup((p) => ({ ...p, name: e.target.value }))
							}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label className="text-xs">UI Color Assignment</Label>
						<div className="flex gap-2">
							<Input
								type="color"
								value={newGroup.colour}
								onChange={(e) =>
									setNewGroup((p) => ({ ...p, colour: e.target.value }))
								}
								className="w-12 h-9 p-1 shrink-0"
							/>
							<Input
								type="text"
								value={newGroup.colour}
								onChange={(e) =>
									setNewGroup((p) => ({ ...p, colour: e.target.value }))
								}
								className="font-mono text-xs"
							/>
						</div>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label className="text-xs">Lucide Symbol Icon Key</Label>
						<IconPicker
							value={newGroup.icon}
							onChange={(icon) => setNewGroup((p) => ({ ...p, icon }))}
						/>
					</div>
				</div>

				<ScrollArea className="h-[380px] w-full">
					<div className="min-w-[600px] pr-4 flex flex-col">
						<PermissionGrid
							bitfield={newGroup.permissions}
							editable={true}
							onToggle={(bit) => {
								if (bit === UserPermissions.MASTER) return;
								setNewGroup((p) => ({ ...p, permissions: p.permissions ^ bit }));
							}}
						/>
					</div>
					<ScrollBar orientation="vertical" />
				</ScrollArea>

				<Button
					type="button"
					size="sm"
					variant="secondary"
					className="gap-1.5 ml-auto w-full md:w-auto px-4"
					onClick={handleAdd}
				>
					<Plus className="size-4" /> Stage & Save Group Parameters
				</Button>
			</div>

			<div className="xl:col-span-3 flex flex-col gap-4 self-stretch">
				<div className="border p-5 bg-muted/40 rounded-xl flex-1 flex flex-col justify-between gap-5 min-h-[350px]">
					<div className="space-y-4">
						<div>
							<h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
								Configured Roles Matrix
							</h4>
							<p className="text-[11px] text-muted-foreground">
								Groups pushed down to the deployment stack payload:
							</p>
						</div>

						{formData.adminGroups.length === 0 ? (
							<div className="text-xs text-muted-foreground italic border border-dashed rounded-lg p-5 text-center bg-background/50">
								No customized operational roles staged yet. Leaving this blank
								sets application configuration defaults.
							</div>
						) : (
							<div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
								{formData.adminGroups.map((grp, index) => {
									const IconComponent = grp.icon
										? getIconComponent(grp.icon)
										: null;
									const Icon = IconComponent || CircleHelp;

									return (
										<div
											key={grp.name.toLowerCase().replace(' ', '-')}
											className="flex items-center justify-between text-xs bg-background p-3 rounded-lg border shadow-xs"
										>
											<div className="flex items-center gap-2.5 overflow-hidden">
												<Icon
													className="w-5 h-5 shrink-0"
													stroke={grp.colour || 'currentColor'}
												/>
												<div className="truncate">
													<p className="font-bold text-foreground truncate">
														{grp.name}
													</p>
													<p className="text-[10px] font-mono text-muted-foreground truncate">
														Bits: {grp.permissions}
													</p>
												</div>
											</div>

											<Button
												type="button"
												size="icon"
												variant="ghost"
												className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
												onClick={(e) => {
													e.preventDefault();
													onRemoveGroup(index);
												}}
											>
												<Trash2 className="size-3.5" />
											</Button>
										</div>
									);
								})}
							</div>
						)}
					</div>

					<div className="flex flex-col gap-2 pt-4 border-t border-border/80">
						<Button
							className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
							onClick={onSubmit}
							disabled={loading}
						>
							{loading ? 'Deploying Environment...' : 'Commit Configuration'}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="w-full gap-1 text-xs text-muted-foreground"
							onClick={onBack}
							disabled={loading}
						>
							<ArrowLeft className="size-3.5" /> Back to Server Settings
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
