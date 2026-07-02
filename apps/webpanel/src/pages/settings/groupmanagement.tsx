import { PageHeader } from '@/components/page-header';
import { useGroups, type AdminGroupEntry } from '@/hooks/use-groups';
import { QueryService } from '@/lib/query';
import {
	PERMISSION_LABELS,
	UserPermissions,
} from '@fxmanager/shared/constants';
import type { AdminGroup, ApiResponse } from '@fxmanager/shared/types';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@fxmanager/ui/components/alert-dialog';
import { GroupBadge } from '@/components/group-badge';
import { Button } from '@fxmanager/ui/components/button';
import { Card } from '@fxmanager/ui/components/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@fxmanager/ui/components/dialog';
import {
	DynamicIcon,
	type LucidIconName,
} from '@fxmanager/ui/components/dynamic-icon';
import { Input } from '@fxmanager/ui/components/input';
import { Label } from '@fxmanager/ui/components/label';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@fxmanager/ui/components/table';
import { Loader2, Pencil, Plus, Trash2, UsersRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PermissionGrid } from './components/permissiongrid';

const countPermissions = (bitfield: number) =>
	Object.keys(PERMISSION_LABELS).filter((bit) => bitfield & Number(bit)).length;

function GroupDialog({
	group,
	open,
	onClose,
	onSaved,
}: {
	group: AdminGroupEntry | null;
	open: boolean;
	onClose: () => void;
	onSaved: () => void;
}) {
	const [name, setName] = useState('');
	const [colour, setColour] = useState('#ff6600');
	const [icon, setIcon] = useState('');
	const [permissions, setPermissions] = useState(0);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!open) return;

		setName(group?.name ?? '');
		setColour(group?.colour ?? '#ff6600');
		setIcon(group?.icon ?? '');
		setPermissions(group?.permissions ?? 0);
	}, [group, open]);

	const togglePermission = (bit: number) => {
		if (bit === UserPermissions.MASTER) return;
		setPermissions((prev) => prev ^ bit);
	};

	async function handleSave() {
		if (!name.trim()) {
			toast.error('Group name is required');
			return;
		}

		setSaving(true);

		try {
			const response = await QueryService<ApiResponse<AdminGroup>>({
				endpoint: group
					? `/settings/groups/${group.id}/update`
					: '/settings/groups/create',
				method: 'POST',
				body: {
					name: name.trim(),
					permissions,
					colour,
					icon: icon.trim() || null,
				},
			});

			if (response.success) {
				toast.success(group ? 'Group updated' : 'Group created');
				onSaved();
			} else {
				toast.error(response.error);
			}
		} catch (err) {
			toast.error('Saving group failed', {
				description: (err as Error).message,
			});
		} finally {
			setSaving(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => !next && onClose()}>
			<DialogContent className="sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>{group ? `Edit ${group.name}` : 'Create Group'}</DialogTitle>
					<DialogDescription>
						Members inherit exactly the permissions of their group, both on the
						panel and in-game.
					</DialogDescription>
				</DialogHeader>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div className="space-y-2">
						<Label className="text-sm font-medium">Name</Label>
						<Input
							placeholder="e.g. Moderation"
							value={name}
							onChange={(e) => setName(e.target.value)}
						/>
					</div>

					<div className="space-y-2">
						<Label className="text-sm font-medium">Colour</Label>
						<Input
							type="color"
							value={colour}
							onChange={(e) => setColour(e.target.value)}
							className="h-9 p-1"
						/>
					</div>

					<div className="space-y-2">
						<Label className="text-sm font-medium">Icon (lucide name)</Label>
						<div className="flex items-center gap-2">
							<Input
								placeholder="e.g. Shield"
								value={icon}
								onChange={(e) => setIcon(e.target.value)}
							/>
							{icon && (
								<DynamicIcon name={icon as LucidIconName} color={colour} />
							)}
						</div>
					</div>
				</div>

				<div className="flex flex-col max-h-[50vh] min-h-64">
					<PermissionGrid
						bitfield={permissions}
						editable={true}
						onToggle={togglePermission}
					/>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSave} disabled={saving}>
						{saving && <Loader2 className="h-4 w-4 animate-spin" />}
						{group ? 'Save Changes' : 'Create Group'}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export default function GroupManagement() {
	const { groups, loading, refresh } = useGroups();
	const [dialog, setDialog] = useState<AdminGroupEntry | 'new' | null>(null);

	async function handleDelete(group: AdminGroupEntry) {
		try {
			const response = await QueryService<ApiResponse>({
				endpoint: `/settings/groups/${group.id}/delete`,
				method: 'POST',
			});

			if (response.success) {
				toast.success(`Group "${group.name}" deleted`);
				void refresh();
			} else {
				toast.error(response.error);
			}
		} catch (err) {
			toast.error('Deleting group failed', {
				description: (err as Error).message,
			});
		}
	}

	return (
		<div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
			<PageHeader
				Icon={UsersRound}
				title="Permission Groups"
				description="Define permission sets and assign admins to them."
			/>

			<div className="flex flex-row justify-end">
				<Button onClick={() => setDialog('new')}>
					<Plus />
					<span className="hidden lg:block">Create Group</span>
				</Button>
			</div>

			<Card className="bg-card/50 py-0">
				<div className="overflow-hidden rounded-lg">
					<Table className="table-fixed w-full">
						<TableHeader className="bg-card block w-full">
							<TableRow className="flex w-full">
								<TableHead className="pl-4 flex-1 flex items-center">
									Group
								</TableHead>
								<TableHead className="flex-1 flex items-center">
									Members
								</TableHead>
								<TableHead className="flex-1 flex items-center">
									Permissions
								</TableHead>
								<TableHead className="w-70 flex items-center" />
							</TableRow>
						</TableHeader>
						<TableBody className="block w-full">
							<ScrollArea className="h-[65vh]">
								{loading ? (
									<TableRow className="flex w-full">
										<TableCell
											colSpan={4}
											className="flex-1 text-center text-muted-foreground"
										>
											Loading...
										</TableCell>
									</TableRow>
								) : groups.length === 0 ? (
									<TableRow className="flex w-full">
										<TableCell
											colSpan={4}
											className="flex-1 text-center text-muted-foreground"
										>
											No groups yet, create one to get started.
										</TableCell>
									</TableRow>
								) : (
									groups.map((group) => (
										<TableRow key={group.id} className="flex w-full items-center">
											<TableCell className="font-medium pl-4 flex-1 flex items-center gap-2 truncate">
												<GroupBadge group={group} />
											</TableCell>
											<TableCell className="flex-1 flex items-center text-sm text-muted-foreground">
												{group.memberCount}
											</TableCell>
											<TableCell className="flex-1 flex items-center text-sm text-muted-foreground">
												{countPermissions(group.permissions)} granted
											</TableCell>
											<TableCell className="w-70 flex justify-end gap-2 pr-4">
												<Button
													size="sm"
													variant="outline"
													className="h-7"
													onClick={() => setDialog(group)}
												>
													<Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
												</Button>

												<AlertDialog>
													<AlertDialogTrigger asChild>
														<Button
															size="sm"
															variant="destructive"
															className="h-7"
															disabled={group.memberCount > 0}
														>
															<Trash2 className="h-3.5 w-3.5" />
														</Button>
													</AlertDialogTrigger>

													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>
																Delete "{group.name}"?
															</AlertDialogTitle>
															<AlertDialogDescription>
																This action cannot be undone. Admins can no
																longer be assigned to this group.
															</AlertDialogDescription>
														</AlertDialogHeader>

														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction
																onClick={() => handleDelete(group)}
																variant="destructive"
															>
																Delete Group
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</TableCell>
										</TableRow>
									))
								)}
							</ScrollArea>
						</TableBody>
					</Table>
				</div>
			</Card>

			<GroupDialog
				group={dialog === 'new' ? null : dialog}
				open={dialog !== null}
				onClose={() => setDialog(null)}
				onSaved={() => {
					setDialog(null);
					void refresh();
				}}
			/>
		</div>
	);
}
