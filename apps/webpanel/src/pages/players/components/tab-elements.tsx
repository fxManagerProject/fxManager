import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@fxmanager/ui/components/table';
import {
	AlertTriangle,
	Ban,
	Clock,
	FileText,
	Flag,
	Hammer,
	Loader2,
	StickyNote,
	Undo2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDate, formatDuration } from '@/lib/utils';
import { QueryService } from '@/lib/query';
import PageSelector from '@/components/page-selector';
import PageSizeSelector from '@/components/page-size-selector';
import { Badge } from '@fxmanager/ui/components/badge';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
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
import type { PlayerProfile } from '@fxmanager/database/types';
import type {
	ApiResponse,
	PaginatedResponse,
	PlayerSession,
	RevokeActionType,
} from '@fxmanager/shared/types';
import { useAuth } from '@/hooks/use-auth';
import { PermissionManager } from '@fxmanager/shared/utils';
import { UserPermissions } from '@fxmanager/shared/constants';
import { Button } from '@fxmanager/ui/components/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Separator } from '@fxmanager/ui/components/separator';

const REVOKE_PERMISSION: Record<RevokeActionType, number> = {
	ban: UserPermissions.REVOKE_BAN,
	kick: UserPermissions.REVOKE_KICK,
	warn: UserPermissions.REVOKE_WARN,
};

function RevokeActionButton({
	type,
	id,
	playerId,
	label,
	onRevoked,
}: {
	type: RevokeActionType;
	id: number;
	playerId: number;
	label: string;
	onRevoked: () => void;
}) {
	const { hasPermission } = useAuth();
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);

	if (!hasPermission(REVOKE_PERMISSION[type])) return null;

	const handleRevoke = async () => {
		setLoading(true);
		try {
			const res = await QueryService<ApiResponse>({
				endpoint: `/players/${playerId}/revoke`,
				method: 'POST',
				body: { type, id },
			});

			if (res.success) {
				toast.success(`${label} revoked.`);
				setOpen(false);
				onRevoked();
			} else {
				toast.error(res.error ?? `Failed to revoke ${label.toLowerCase()}.`);
			}
		} catch {
			toast.error('An unexpected error occurred.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={setOpen}>
			<AlertDialogTrigger asChild>
				<Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
					<Undo2 className="h-3.5 w-3.5" />
					Revoke
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>Revoke {label.toLowerCase()}?</AlertDialogTitle>
					<AlertDialogDescription>
						This lifts the {label.toLowerCase()} and notifies in-game resources.
						The action is recorded in the audit log.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={loading}
						onClick={(e) => {
							e.preventDefault();
							handleRevoke();
						}}
					>
						{loading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<Undo2 className="h-4 w-4" />
						)}
						Revoke
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

function RevocableStatus({ revoked }: { revoked: number }) {
	return (
		<Badge variant={revoked ? 'success' : 'outline'}>
			{revoked ? 'Revoked' : 'Active'}
		</Badge>
	);
}

export function BansTab({
	bans,
	playerId,
	onRevoked,
}: {
	bans: PlayerProfile['punishments']['bans'];
	playerId: number;
	onRevoked: () => void;
}) {
	if (!bans.length)
		return <EmptyState icon={Ban} message="No bans on record" />;

	const now = new Date();

	function BanStatus({
		ban,
	}: {
		ban: PlayerProfile['punishments']['bans'][0];
	}) {
		const variant = ban.revokedAt
			? 'success'
			: !ban.expiresAt || ban.expiresAt > now
				? 'destructive'
				: 'outline';

		const label = ban.revokedAt
			? 'Revoked'
			: !ban.expiresAt || ban.expiresAt > now
				? 'Active'
				: 'Expired';

		return <Badge variant={variant}>{label}</Badge>;
	}

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Reason</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Issued by</TableHead>
					<TableHead>Expires</TableHead>
					<TableHead>Created</TableHead>
					<TableHead className="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{bans.map((ban) => (
					<TableRow key={ban.id}>
						<TableCell className="max-w-[240px] truncate">
							{ban.reason}
						</TableCell>
						<TableCell>
							<BanStatus ban={ban} />
						</TableCell>
						<TableCell>{ban.issuerName ?? 'System'}</TableCell>
						<TableCell>
							{ban.expiresAt ? (
								formatDate(ban.expiresAt)
							) : (
								<Badge variant="destructive" className="text-xs">
									Permanent
								</Badge>
							)}
						</TableCell>
						<TableCell className="text-muted-foreground text-xs">
							{formatDate(ban.createdAt)}
						</TableCell>
						<TableCell className="text-right">
							{!ban.revokedAt && (
								<RevokeActionButton
									type="ban"
									id={ban.id}
									playerId={playerId}
									label="Ban"
									onRevoked={onRevoked}
								/>
							)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export function WarnsTab({
	warns,
	playerId,
	onRevoked,
}: {
	warns: PlayerProfile['punishments']['warns'];
	playerId: number;
	onRevoked: () => void;
}) {
	if (!warns.length)
		return <EmptyState icon={AlertTriangle} message="No warnings on record" />;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Reason</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Issued by</TableHead>
					<TableHead>Created</TableHead>
					<TableHead className="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{warns.map((warn) => (
					<TableRow key={warn.id}>
						<TableCell className="max-w-[300px] truncate">
							{warn.reason}
						</TableCell>
						<TableCell>
							<RevocableStatus revoked={warn.revoked} />
						</TableCell>
						<TableCell>{warn.issuerName ?? 'System'}</TableCell>
						<TableCell className="text-muted-foreground text-xs">
							{formatDate(warn.issuedAt)}
						</TableCell>
						<TableCell className="text-right">
							{!warn.revoked && (
								<RevokeActionButton
									type="warn"
									id={warn.id}
									playerId={playerId}
									label="Warning"
									onRevoked={onRevoked}
								/>
							)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export function KicksTab({
	kicks,
	playerId,
	onRevoked,
}: {
	kicks: PlayerProfile['punishments']['kicks'];
	playerId: number;
	onRevoked: () => void;
}) {
	if (!kicks.length)
		return <EmptyState icon={Hammer} message="No kicks on record" />;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Reason</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Issued by</TableHead>
					<TableHead>Issued at</TableHead>
					<TableHead className="text-right">Actions</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{kicks.map((kick) => (
					<TableRow key={kick.id}>
						<TableCell className="max-w-[300px] truncate">
							{kick.reason}
						</TableCell>
						<TableCell>
							<RevocableStatus revoked={kick.revoked} />
						</TableCell>
						<TableCell>{kick.issuerName ?? 'System'}</TableCell>
						<TableCell className="text-muted-foreground text-xs">
							{formatDate(kick.issuedAt)}
						</TableCell>
						<TableCell className="text-right">
							{!kick.revoked && (
								<RevokeActionButton
									type="kick"
									id={kick.id}
									playerId={playerId}
									label="Kick"
									onRevoked={onRevoked}
								/>
							)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export function ReportsTab({ reports }: { reports: PlayerProfile['reports'] }) {
	if (!reports.length)
		return <EmptyState icon={Flag} message="No reports found" />;
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Description</TableHead>
					<TableHead>Reported by</TableHead>
					<TableHead>Status</TableHead>
					<TableHead>Created</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				{reports.map((report) => (
					<TableRow key={report.id}>
						<TableCell className="max-w-[260px] truncate">
							{report.subject}
						</TableCell>
						<TableCell>
							{report.reporterName ?? `Player #${report.reporterId}`}
						</TableCell>
						<TableCell>
							<Badge
								variant={report.status === 'open' ? 'secondary' : 'outline'}
								className="capitalize text-xs"
							>
								{report.status}
							</Badge>
						</TableCell>
						<TableCell className="text-muted-foreground text-xs">
							{formatDate(report.openedAt)}
						</TableCell>
					</TableRow>
				))}
			</TableBody>
		</Table>
	);
}

export function NotesTab({ notes }: { notes: PlayerProfile['notes'] }) {
	if (!notes.length)
		return <EmptyState icon={StickyNote} message="No notes added" />;

	return (
		<div className="space-y-3">
			{notes.map((note) => (
				<div key={note.id} className="p-4">
					<p className="text-sm">{note.content}</p>
					<p className="text-xs text-muted-foreground mt-2">
						Added by{' '}
						<span className="font-medium">{note.issuerName ?? 'System'}</span> ·{' '}
						{formatDate(note.issuedAt)}
					</p>
				</div>
			))}
		</div>
	);
}

export function SessionsTab({ playerId }: { playerId: number }) {
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(20);
	const [items, setItems] = useState<PlayerSession[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const params = new URLSearchParams({
			page: String(page),
			pageSize: String(pageSize),
		});
		QueryService<PaginatedResponse<PlayerSession>>({
			endpoint: `/players/${playerId}/sessions?${params}`,
			method: 'GET',
		})
			.then((res) => {
				if (cancelled) return;
				setItems(res.items);
				setTotal(res.total);
			})
			.catch((err) => console.error('Loading sessions failed', err))
			.finally(() => !cancelled && setLoading(false));
		return () => {
			cancelled = true;
		};
	}, [playerId, page, pageSize]);

	if (!loading && !items.length)
		return <EmptyState icon={Clock} message="No sessions recorded yet" />;

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Connected</TableHead>
						<TableHead>Duration</TableHead>
						<TableHead>Ended</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{items.map((s) => (
						<TableRow key={s.id}>
							<TableCell>{formatDate(new Date(s.connectedAt))}</TableCell>
							<TableCell>
								{s.durationMs == null ? (
									<Badge variant="outline">In progress</Badge>
								) : (
									formatDuration(s.durationMs)
								)}
							</TableCell>
							<TableCell className="max-w-[240px] truncate">
								{s.endReason ?? '—'}
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>
			<div className="flex items-center justify-between px-4 py-4 border-t border-border bg-card">
				<PageSizeSelector
					pageSize={pageSize}
					setPageSize={(n: number) => {
						setPageSize(n);
						setPage(1);
					}}
					label="Sessions per page"
				/>
				<PageSelector
					page={page}
					pageSize={pageSize}
					setPage={setPage}
					loading={loading}
					total={total}
				/>
			</div>
		</>
	);
}

function EmptyState({
	icon: Icon,
	message,
}: {
	icon: React.ElementType;
	message: string;
}) {
	return (
		<div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
			<Icon className="h-8 w-8 opacity-30" />
			<p className="text-sm">{message}</p>
		</div>
	);
}

export function AdminProfile({
	adminProfile,
}: {
	adminProfile: PlayerProfile['adminProfile'];
}) {
	const navigate = useNavigate();
	const { user } = useAuth();

	if (!adminProfile) return null;

	const handleClick = () => {
		toast.info(`Navigating to "${adminProfile.username}" profile view`, {
			icon: <Loader2 className="animate-spin" />,
			duration: 1_500,
		});

		setTimeout(() => navigate(`/settings/admins/${adminProfile.id}`), 1_000);
	};

	return (
		<Card>
			<CardHeader className="pb-2 pt-4 px-4">
				<CardTitle className="text-sm flex items-center gap-2">
					<FileText className="h-4 w-4" />
					Admin Profile
				</CardTitle>
			</CardHeader>
			<CardContent className="px-4 pb-4 pt-2">
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
					<div className="space-y-1">
						<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
							Username
						</p>
						<p className="text-sm font-medium leading-none">
							{adminProfile.username}
						</p>
					</div>

					{adminProfile.createdAt && (
						<div className="space-y-1">
							<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
								Admin since
							</p>
							<p className="text-sm font-medium leading-none">
								{formatDate(adminProfile.createdAt)}
							</p>
						</div>
					)}

					{adminProfile.lastLoginAt && (
						<div className="space-y-1">
							<p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
								Last login
							</p>
							<p className="text-sm font-medium leading-none">
								{formatDate(adminProfile.lastLoginAt)}
							</p>
						</div>
					)}
				</div>

				{PermissionManager.has(
					user?.permissions ?? 0,
					UserPermissions.SETTINGS_ADMIN_MANAGEMENT,
				) && (
					<>
						<Separator className="my-4" />
						<Button
							onClick={handleClick}
							variant="outline"
							size="sm"
							className="w-full sm:w-auto"
						>
							View Profile
						</Button>
					</>
				)}
			</CardContent>
		</Card>
	);
}
