import { QueryService } from '@/lib/query';
import {
	PERMISSION_GROUPS,
	PERMISSION_LABELS,
	UserPermissions,
} from '@fxmanager/shared/constants';
import type { AdminGroup, ApiResponse } from '@fxmanager/shared/types';
import { PermissionManager } from '@fxmanager/shared/utils';
import {
	DynamicIcon,
	type LucidIconName,
} from '@fxmanager/ui/components/dynamic-icon';
import { Input } from '@fxmanager/ui/components/input';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
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
	ShieldCheck,
	Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type PermissionEditorProps =
	| {
			adminId: string;
			editable: boolean;
			value: number;
			skipServerSave?: false;
			updatePerms: (perms: number) => void;
	  }
	| {
			skipServerSave: true;
			value: number;
			updatePerms: (perms: number) => void;
			adminId?: never;
			editable?: never;
	  };

export default function PermissionEditor(props: PermissionEditorProps) {
	const { value, updatePerms, skipServerSave = false } = props;

	const [bitfield, setBitField] = useState<number>(value ?? 0);
	const [permissionGroup, setPermissionGroup] = useState<
		AdminGroup | undefined
	>(undefined);
	const [isSaving, setIsSaving] = useState(false);

	const canEdit = skipServerSave || props.editable;

	const togglePermission = (bit: number) => {
		if (!canEdit || bit === UserPermissions.MASTER) return;
		setBitField((prev) => prev ^ bit);

		if (skipServerSave) {
			updatePerms(bitfield & ~UserPermissions.MASTER);
			return;
		}
	};

	const hasPermission = (bit: number) => (bitfield & bit) !== 0;

	const handleBitFieldChange = ({
		target,
	}: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => {
		const cleanValue = target.value.replace(/[^0-9]/g, '');

		if (cleanValue === '') {
			setBitField(0);
		} else {
			setBitField(parseInt(cleanValue, 10));
		}
	};

	const handleSave = async () => {
		if (skipServerSave) return;

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

	useEffect(() => {
		console.log(bitfield, PermissionManager.getGroup(bitfield));
		setPermissionGroup(PermissionManager.getGroup(bitfield) ?? undefined);
	}, [bitfield]);

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
								value={bitfield}
								disabled={!canEdit}
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
								value={
									permissionGroup !== undefined
										? `${permissionGroup.permissions}`
										: undefined
								}
								disabled={!canEdit}
								onValueChange={(value) => setBitField(parseInt(value, 10))}
							>
								<SelectTrigger className="w-44 border-none bg-muted">
									<SelectValue placeholder="Custom" />
								</SelectTrigger>
								<SelectContent>
									<SelectGroup>
										{PERMISSION_GROUPS.filter(
											(g) => g.permissions !== UserPermissions.MASTER,
										).map((g) => (
											<SelectItem
												key={`${g.permissions}`}
												value={`${g.permissions}`}
											>
												<DynamicIcon
													name={(g.icon as LucidIconName) ?? 'UserRound'}
												/>
												{g.label}
											</SelectItem>
										))}
										<SelectItem value="0">
											<Blend className="h-4 w-4" />
											Custom
										</SelectItem>
									</SelectGroup>
								</SelectContent>
							</Select>
						</div>
					</div>
				</div>

				{canEdit && (
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

			<ScrollArea className="flex-1 border rounded-xl bg-muted/5 overflow-y-auto">
				<div className="p-4 pr-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
					{Object.entries(PERMISSION_LABELS).map(([bitStr, info]) => {
						const bit = parseInt(bitStr, 10);
						const active = hasPermission(bit);

						return (
							<button
								key={bit}
								disabled={!canEdit}
								onClick={() => togglePermission(bit)}
								type="button"
								className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
									active
										? 'border-primary bg-primary/5 ring-1 ring-primary'
										: 'border-transparent bg-muted/40 hover:bg-muted disabled:hover:bg-muted/40'
								}`}
							>
								<div
									className={`mt-0.5 rounded-md p-1 ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
								>
									<ShieldCheck className="h-4 w-4" />
								</div>
								<div>
									<p className="text-sm font-bold">{info.label}</p>
									<p className="text-xs text-muted-foreground">{info.desc}</p>
								</div>
							</button>
						);
					})}
				</div>
			</ScrollArea>
		</div>
	);
}
