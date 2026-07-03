import { QueryService } from '@/lib/query';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@fxmanager/ui/components/avatar';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@fxmanager/ui/components/tabs';
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
import {
	AlertCircle,
	AlertTriangle,
	ArrowLeft,
	Clock,
	FileUser,
	Info,
	Loader2,
	Trash,
	UserPlus,
	UserSearch,
	UsersRound,
} from 'lucide-react';
import { formatDate, initials } from '@/lib/utils';
import { Button } from '@fxmanager/ui/components/button';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import type { ApiError, ApiResponse } from '@fxmanager/shared/types';
import { StatCard } from '@/components/stat-card';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import type { AdminProfile } from '@fxmanager/database/types';
import PermissionEditor from './components/permissioneditor';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@fxmanager/ui/components/alert';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import {
	DynamicIcon,
	type LucidIconName,
} from '@fxmanager/ui/components/dynamic-icon';
import { PlayerSearch } from './components/player-search';
import { AuditLogRow } from './components/auditlog-row';

function LoadingSkeleton() {
	return (
		<div className="space-y-6 p-6">
			{/* header */}
			<div className="flex items-center gap-4">
				<Skeleton className="h-16 w-16 rounded-full" />
				<div className="space-y-2">
					<Skeleton className="h-5 w-48" />
					<Skeleton className="h-4 w-32" />
				</div>
			</div>

			{/* stat cards */}
			<div className="flex gap-3 flex-wrap">
				{Array.from({ length: 4 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: indexes are immutable
					<Skeleton key={i} className="h-24 flex-1 min-w-[140px] rounded-lg" />
				))}
			</div>

			{/*  tabs*/}
			<Skeleton className="h-10 w-full rounded-md" />
			<Skeleton className="h-48 w-full rounded-lg" />
		</div>
	);
}

function PlayerCardContent({
	id,
	name,
}: {
	id: number | null;
	name: string | null;
}) {
	const navigate = useNavigate();

	function handleClick() {
		toast.info(`Navigating to "${name}" player view`, {
			icon: <Loader2 className="animate-spin" />,
			duration: 1_500,
		});

		setTimeout(() => navigate(`/players/${id}`), 1_000);
	}

	if (!id || !name) return <p className="font-mono">Unlinked</p>;

	return (
		<button
			type="button"
			onClick={handleClick}
			className="font-mono cursor-pointer hover:underline"
		>{`${name} (#${id})`}</button>
	);
}

export default function AdminView() {
	const navigate = useNavigate();
	const { user, hasPermission } = useAuth();
	const params = useParams<{ adminId: string }>();
	const [adminData, setAdminData] = useState<AdminProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!params.adminId) return;

		QueryService<ApiResponse<AdminProfile>>({
			endpoint: `/settings/admins/${params.adminId}`,
			method: 'GET',
		})
			.then((res) => {
				setError(null);
				if (res.success) {
					setAdminData(res.data);
				} else {
					setError(res.error);
				}
			})
			.catch((err) => {
				console.error('Loading admin failed', err.status, err.message);
				setError((err as ApiError).message ?? 'Failed to load admin data.');
			})
			.finally(() => setLoading(false));
	}, [params.adminId]);

	async function handleDelete() {
		const deletePromise = QueryService<ApiResponse<undefined>>({
			endpoint: `/settings/admins/${params.adminId}/delete`,
			method: 'POST',
		});

		toast.promise(deletePromise, {
			loading: 'Deleting admin account...',
			success: (r) => {
				if (!r.success) throw new Error(r.error);

				setTimeout(
					() => navigate('/settings/admins', { replace: true }),
					1_500,
				);

				return `Admin has been successfully removed.`;
			},
			error: (err) => {
				console.error('Failed to delete admin', err.message);
				return `Deletion failed: ${err.message}`;
			},
		});
	}

	async function handleLinkedPlayerChange(playerId: AdminProfile['playerId']) {
		const changePromise = QueryService<
			ApiResponse<{ newPlayerId: AdminProfile['playerId'] }>
		>({
			endpoint: `/settings/admins/${params.adminId}/player`,
			method: 'POST',
			body: { playerId },
		});

		toast.promise(changePromise, {
			loading: 'Updating linked player...',
			success: (r) => {
				if (!r.success) throw new Error(r.error);

				setAdminData((prev) => {
					if (!prev) throw new Error('Invalid Action Sequence (no admin data)');

					return {
						...prev,
						playerId: r.data.newPlayerId,
					};
				});

				return `Linked player has been updated.`;
			},
			error: (err) => {
				console.error('Failed to update linked player', err.message);
				return `Update failed: ${err.message}`;
			},
		});
	}

	if (loading) return <LoadingSkeleton />;

	if (error || !adminData || !params.adminId) {
		return (
			<Card className="w-full mt-12">
				<CardContent className="py-6 flex flex-col items-center gap-3 text-center">
					<AlertTriangle className="h-8 w-8 text-destructive" />

					<p className="font-semibold">Failed to load admin</p>
					<p className="text-sm text-muted-foreground">
						{error ?? 'Admin not found.'}
					</p>

					<Button variant="outline" size="sm" asChild>
						<Link to="/settings/admins">
							<ArrowLeft className="h-4 w-4" />
							Back to Admins
						</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	const isMaster = PermissionManager.isMaster(adminData.permissions);

	return (
		<div>
			<div className="flex flex-row justify-between items-center pr-4">
				<div className="flex items-center gap-3 my-4">
					<Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
						<ArrowLeft className="h-4 w-4" />
					</Button>

					<Avatar className="h-12 w-12 text-base shrink-0">
						<AvatarFallback>{initials(adminData.username)}</AvatarFallback>
					</Avatar>

					<div className="flex-1 min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-lg font-bold truncate">
								{adminData.username}
							</h1>
						</div>
						<p className="text-xs text-muted-foreground">
							Admin #{adminData.id}
						</p>
					</div>
				</div>

				<div className="space-x-2">
					{(!isMaster || adminData.id === user?.id) && (
						<PlayerSearch
							value={adminData.playerId}
							onChange={(id) => handleLinkedPlayerChange(id)}
							align="end"
							trigger={
								<Button variant="outline">
									<UserSearch className="h-4 w-4" />
									<span className="hidden lg:block">Update linked player</span>
								</Button>
							}
						/>
					)}
					{!isMaster && (
						<AlertDialog>
							<AlertDialogTrigger asChild>
								<Button variant="destructive">
									<Trash />
									<span className="hidden md:block">Delete User</span>
								</Button>
							</AlertDialogTrigger>

							<AlertDialogContent>
								<AlertDialogHeader>
									<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
									<AlertDialogDescription>
										This action cannot be undone. This will permanently delete
										the admin account for{' '}
										<span className="font-bold text-foreground">
											{adminData.username}{' '}
										</span>
										and remove their access from the panel.
									</AlertDialogDescription>
								</AlertDialogHeader>

								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<AlertDialogAction
										onClick={handleDelete}
										variant="destructive"
									>
										Delete User
									</AlertDialogAction>
								</AlertDialogFooter>
							</AlertDialogContent>
						</AlertDialog>
					)}
				</div>
			</div>

			<div className="space-y-6 pt-2 pb-0 pl-0 pr-4">
				<div className="flex flex-wrap gap-3 flex-col md:flex-row">
					<StatCard
						icon={FileUser}
						label="Linked Player"
						value={
							<PlayerCardContent
								id={adminData.playerId}
								name={adminData.playerName}
							/>
						}
					/>
					<StatCard
						icon={UserPlus}
						label="Created On"
						value={formatDate(adminData.createdAt)}
					/>
					<StatCard
						icon={Clock}
						label="Last Login"
						value={formatDate(adminData.lastLoginAt)}
					/>
					<StatCard
						icon={
							adminData.group?.icon
								? () => (
										<DynamicIcon
											name={adminData.group?.icon as LucidIconName}
											color={adminData.group?.colour}
										/>
									)
								: UsersRound
						}
						className="hidden lg:block"
						label={`Staff Group`}
						value={adminData.group?.name ?? 'Custom'}
					/>
				</div>

				<Tabs defaultValue="activity" className="w-full">
					<TabsList className="grid w-full grid-cols-2 mb-4">
						<TabsTrigger value="activity">Recent Activity</TabsTrigger>
						<TabsTrigger value="settings">Permissions</TabsTrigger>
					</TabsList>

					<TabsContent value="activity">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg font-bold">
									Action Recap
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ScrollArea className="min-h-[40vh] h-[calc(100vh-27rem)]">
									{!hasPermission(UserPermissions.AUDIT_LOG) ? (
										<Alert
											variant="destructive"
											className="bg-destructive/5 border-destructive/20"
										>
											<AlertCircle className="h-4 w-4" />
											<AlertTitle className="font-bold">
												Access Restricted
											</AlertTitle>
											<AlertDescription>
												You do not have permissions to view an admins audit log.
											</AlertDescription>
										</Alert>
									) : (
										<div className="">
											{adminData.auditLogs.length > 0 ? (
												adminData.auditLogs.map((log) => (
													<AuditLogRow key={log.id} log={log} />
												))
											) : (
												<div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg bg-muted/30">
													<Info className="h-8 w-8 text-muted-foreground/60 mb-2" />
													<p className="text-sm font-medium text-muted-foreground">
														No recent activity logs
													</p>
													<p className="text-xs text-muted-foreground/70">
														Actions performed by this admin will appear here.
													</p>
												</div>
											)}
										</div>
									)}
								</ScrollArea>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="settings" className="mt-0 outline-none">
						<Card className="h-[100vh] md:h-[64vh] flex flex-col overflow-hidden">
							<CardHeader className="shrink-0">
								<CardTitle className="text-lg font-bold">
									Permissions Editor
								</CardTitle>
							</CardHeader>

							<CardContent className="flex-1 flex flex-col min-h-0 px-6 pt-0 overflow-hidden">
								{isMaster ? (
									<Alert
										variant="destructive"
										className="bg-destructive/5 border-destructive/20"
									>
										<AlertCircle className="h-4 w-4" />
										<AlertTitle className="font-bold">
											Access Restricted
										</AlertTitle>
										<AlertDescription>
											This is a <strong>Master Account</strong>. Permissions are
											hardcoded and cannot be modified via the dashboard for
											security reasons.
										</AlertDescription>
									</Alert>
								) : (
									<PermissionEditor
										editable={adminData.id !== user?.id}
										adminId={params.adminId}
										value={adminData.permissions}
										group={adminData.group}
										updatePerms={(permissions) =>
											setAdminData((prev) => {
												if (!prev) return null;
												return { ...prev, permissions };
											})
										}
										updateGroup={(group) =>
											setAdminData((prev) => {
												if (!prev) return null;
												return { ...prev, group };
											})
										}
									/>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
