import { QueryService } from '@/lib/query';
import { UserPermissions } from '@fxmanager/shared/constants';
import type { ApiResponse } from '@fxmanager/shared/types';
import { Input } from '@fxmanager/ui/components/input';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import {
	Hash,
	Loader2,
	RotateCcw,
	Save,
	ShieldCheck,
	Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export const PERMISSION_LABELS: Record<
	number,
	{ label: string; desc: string; category: string }
> = {
	[UserPermissions.KICK]: {
		label: 'Kick Players',
		desc: 'Disconnect players from the server.',
		category: 'Moderation',
	},
	[UserPermissions.BAN]: {
		label: 'Ban Players',
		desc: 'Prevent players from reconnecting.',
		category: 'Moderation',
	},
	[UserPermissions.WARN]: {
		label: 'Warn Players',
		desc: 'Issue formal warnings to users.',
		category: 'Moderation',
	},
	[UserPermissions.REVOKE_KICK]: {
		label: 'Revoke Kicks',
		desc: 'Clear kick history for players.',
		category: 'Moderation',
	},
	[UserPermissions.REVOKE_BAN]: {
		label: 'Revoke Bans',
		desc: 'Unban players from the server.',
		category: 'Moderation',
	},
	[UserPermissions.REVOKE_WARN]: {
		label: 'Revoke Warns',
		desc: 'Remove warnings from player profiles.',
		category: 'Moderation',
	},

	[UserPermissions.WHITELIST]: {
		label: 'Add Whitelist',
		desc: 'Grant whitelist access to players.',
		category: 'Access Control',
	},
	[UserPermissions.REVOKE_WHITELIST]: {
		label: 'Remove Whitelist',
		desc: 'Strip whitelist access from players.',
		category: 'Access Control',
	},

	[UserPermissions.VIEW_REPORT]: {
		label: 'View Reports',
		desc: 'Read incoming player reports.',
		category: 'Reporting',
	},
	[UserPermissions.SEND_REPORT]: {
		label: 'Reply to Reports',
		desc: 'Send messages within report threads.',
		category: 'Reporting',
	},
	[UserPermissions.CLOSE_REPORT]: {
		label: 'Resolve Reports',
		desc: 'Mark reports as closed or resolved.',
		category: 'Reporting',
	},

	[UserPermissions.SERVER_ACTIONS]: {
		label: 'Power Actions',
		desc: 'Start, stop, or restart the server.',
		category: 'System',
	},
	[UserPermissions.CONSOLE_VIEW]: {
		label: 'View Console',
		desc: 'Read-only access to live server logs.',
		category: 'System',
	},
	[UserPermissions.CONSOLE_ACCESS]: {
		label: 'Execute Console',
		desc: 'Run commands directly via console.',
		category: 'System',
	},

	[UserPermissions.SETTINGS_ACCESS]: {
		label: 'System Settings',
		desc: 'Modify global server configuration.',
		category: 'Administration',
	},
	[UserPermissions.SETTINGS_ADMIN_MANAGEMENT]: {
		label: 'Manage Admins',
		desc: 'Create, edit, and delete admin users.',
		category: 'Administration',
	},
};

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
	const [isSaving, setIsSaving] = useState(false);

	const canEdit = skipServerSave || props.editable;

	const togglePermission = (bit: number) => {
		if (!canEdit || bit === UserPermissions.MASTER) return;
		setBitField((prev) => prev ^ bit);
	};

	const hasPermission = (bit: number) => (bitfield & bit) !== 0;

	const handleSave = async () => {
		setIsSaving(true);

		if (skipServerSave) {
			updatePerms(bitfield & ~UserPermissions.MASTER);
			setIsSaving(false);
			return;
		}

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
								Current Bitmask
							</span>
							<Input
								type="text"
								value={bitfield}
								disabled={!canEdit}
								onChange={(e) => setBitField(Number(e.target.value) || 0)}
								className="bg-muted border-none rounded px-2 py-1 text-sm font-mono w-32 text-right"
							/>
						</div>
					</div>
				</div>

				{canEdit && (
					<div className="flex items-center gap-2">
						<button
							onClick={() => setBitField(0)}
							disabled={bitfield === 0}
							className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg transition-colors disabled:opacity-50"
						>
							<Trash2 className="h-4 w-4" />
							Clear
						</button>

						<button
							onClick={() => setBitField(value)}
							disabled={bitfield === value}
							className="flex items-center gap-2 px-3 py-2 text-xs font-medium hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
						>
							<RotateCcw className="h-4 w-4" />
							Reset
						</button>

						{!skipServerSave && (
							<button
								onClick={handleSave}
								disabled={isSaving || bitfield === value}
								className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 rounded-lg shadow-sm transition-all"
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
						const bit = parseInt(bitStr);
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
