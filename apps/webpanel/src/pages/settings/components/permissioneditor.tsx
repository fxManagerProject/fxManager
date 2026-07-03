import { QueryService } from '@/lib/query';
import { useGroups } from '@/hooks/use-groups';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { AdminGroup, ApiResponse } from '@fxmanager/shared/types';
import {
	DynamicIcon,
	type LucidIconName,
} from '@fxmanager/ui/components/dynamic-icon';
import { Input } from '@fxmanager/ui/components/input';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import {
	Blend,
	Hash,
	Layers,
	Loader2,
	RotateCcw,
	Save,
	Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PermissionGrid } from './permissiongrid';

type PermissionEditorProps =
	| {
			adminId: string;
			editable: boolean;
			value: number;
			group: AdminGroup | null;
			skipServerSave?: false;
			updatePerms: (perms: number) => void;
			updateGroup: (group: AdminGroup | null) => void;
	  }
	| {
			skipServerSave: true;
			value: number;
			group: AdminGroup | null;
			updatePerms: (perms: number) => void;
			updateGroup: (group: AdminGroup | null) => void;
			adminId?: never;
			editable?: never;
	  };

export default function PermissionEditor(props: PermissionEditorProps) {
	const {
		value,
		group,
		updatePerms,
		updateGroup,
		skipServerSave = false,
	} = props;

	const { groups } = useGroups();
	const [bitfield, setBitField] = useState<number>(value ?? 0);
	const [isSaving, setIsSaving] = useState(false);

	const canEdit = skipServerSave || props.editable;
	const isGrouped = group !== null;
	// a group fully defines the permissions of its members
	const displayedBitfield = group ? group.permissions : bitfield;

	const togglePermission = (bit: number) => {
		if (!canEdit || isGrouped || bit === UserPermissions.MASTER) return;

		const nextBitfield = bitfield ^ bit;
		setBitField(nextBitfield);

		if (skipServerSave) {
			updatePerms(nextBitfield & ~UserPermissions.MASTER);
		}
	};

	const handleBitFieldChange = ({
		target,
	}: React.ChangeEvent<HTMLInputElement>) => {
		if (isGrouped) return;

		const cleanValue = target.value.replace(/[^0-9]/g, '');
		const nextBitfield = cleanValue === '' ? 0 : parseInt(cleanValue, 10);
		setBitField(nextBitfield);

		if (skipServerSave) {
			updatePerms(nextBitfield & ~UserPermissions.MASTER);
		}
	};

	const handleGroupSelect = async (selected: string) => {
		const nextGroup =
			selected === 'custom'
				? null
				: (groups.find((g) => `${g.id}` === selected) ?? null);

		if (skipServerSave) {
			updateGroup(nextGroup);
			return;
		}

		try {
			const response = await QueryService<
				ApiResponse<{ newGroupId: number | null }>
			>({
				endpoint: `/settings/admins/${props.adminId}/group`,
				method: 'POST',
				body: { groupId: nextGroup?.id ?? null },
			});

			if (response.success) {
				updateGroup(nextGroup);
				toast.success(
					nextGroup
						? `Assigned to ${nextGroup.name}`
						: 'Group removed, using custom permissions',
				);
			} else {
				toast.error(response.error);
			}
		} catch (err) {
			toast.error('Sync failed', { description: (err as Error).message });
		}
	};

	const handleSave = async () => {
		if (skipServerSave || isGrouped) return;

		setIsSaving(true);

		try {
			const response = await QueryService<ApiResponse<number>>({
				endpoint: `/settings/admins/${props.adminId}/permissions`,
				method: 'POST',
				body: { permissions: bitfield },
			});

			if (response.success) {
				updatePerms(response.data);
				toast.success('Permissions updated successfully');
			} else {
				toast.error(response.error);
			}
		} catch (err) {
			toast.error('Sync failed', { description: (err as Error).message });
		} finally {
			setIsSaving(false);
		}
	};

	return (
		<div className="flex flex-col flex-1 min-h-0 space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border bg-card shadow-sm shrink-0">
				<div className="flex items-center gap-4">
					<div className="flex flex-row gap-2 items-center">
						<Hash className="h-6 w-6 text-muted-foreground" />
						<div className="flex flex-col items-start">
							<span className="text-[10px] uppercase font-bold text-muted-foreground">
								Bitmask
							</span>
							<Input
								type="text"
								value={displayedBitfield}
								disabled={!canEdit || isGrouped}
								onChange={handleBitFieldChange}
								className="bg-muted border-none rounded px-2 py-1 text-sm font-mono w-32 text-right"
							/>
						</div>
					</div>

					<div className="flex flex-row gap-2 items-center pl-3">
						<Layers className="h-6 w-6 text-muted-foreground" />
						<div className="flex flex-col items-start">
							<span className="text-[10px] uppercase font-bold text-muted-foreground">
								Permission Group
							</span>
							<Select
								value={group ? `${group.id}` : 'custom'}
								disabled={!canEdit}
								onValueChange={handleGroupSelect}
							>
								<SelectTrigger className="w-44 border-none bg-muted">
									<SelectValue placeholder="Custom" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{groups.map((g) => (
											<SelectItem key={g.id} value={`${g.id}`}>
												<DynamicIcon
													name={(g.icon as LucidIconName) ?? 'UserRound'}
													color={g.colour}
												/>
												{g.name}
											</SelectItem>
										))}
										<SelectItem value="custom">
											<Blend className="h-4 w-4" />
											Custom
										</SelectItem>
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{canEdit && !isGrouped && (
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => setBitField(0)}
							disabled={bitfield === 0}
							className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive enabled:hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
						>
							<Trash2 className="h-4 w-4" />
							Clear
						</button>

						<button
							type="button"
							onClick={() => setBitField(value)}
							disabled={bitfield === value}
							className="flex items-center gap-2 px-3 py-2 text-xs font-medium enabled:hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
						>
							<RotateCcw className="h-4 w-4" />
							Reset
						</button>

						{!skipServerSave && (
							<button
								type="button"
								onClick={handleSave}
								disabled={isSaving || bitfield === value}
								className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground enabled:hover:bg-primary/90 disabled:opacity-50 rounded-lg shadow-sm transition-all"
							>
								{isSaving ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<Save className="h-4 w-4" />
								)}
								{isSaving ? 'Saving...' : 'Save Changes'}
							</button>
						)}
					</div>
				)}
			</div>

			<PermissionGrid
				bitfield={displayedBitfield}
				editable={!!canEdit && !isGrouped}
				onToggle={togglePermission}
			/>
		</div>
	);
}
