import { QueryService } from '@/lib/query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
	AlertTriangle,
	ArrowLeft,
	Clock,
	FileUser,
	Info,
	Loader2,
	UserPlus,
	UsersRound,
} from 'lucide-react';
import { formatDate, initials } from '@/lib/utils';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Label } from '@fxmanager/ui/components/label';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import type { ApiError, ApiResponse } from '@fxmanager/shared/types';
import { StatCard } from '@/components/stat-card';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import type { AdminProfile } from '@fxmanager/database/types';
import PermissionEditor from './components/permissioneditor';
import { toast } from 'sonner';
import {
	DynamicIcon,
	type LucidIconName,
} from '@fxmanager/ui/components/dynamic-icon';
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

			{/* tabs */}
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

	if (!id || !name)
		return <p className="font-mono text-muted-foreground">Unlinked</p>;

	return (
		<button
			type="button"
			onClick={handleClick}
			className="font-mono cursor-pointer hover:underline text-foreground font-semibold"
		>{`${name} (#${id})`}</button>
	);
}

function IdentifiersForm({
	cfxId: initialCfxId,
	discordId: initialDiscordId,
	canEdit = true,
	onSave,
}: {
	cfxId: string | null;
	discordId: string | null;
	canEdit?: boolean;
	onSave: (data: { cfxId: string; discordId: string }) => Promise<void>;
}) {
	const [cfxId, setCfxId] = useState(initialCfxId ?? '');
	const [discordId, setDiscordId] = useState(initialDiscordId ?? '');
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		setCfxId(initialCfxId ?? '');
		setDiscordId(initialDiscordId ?? '');
	}, [initialCfxId, initialDiscordId]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!canEdit) return;
		setIsSubmitting(true);
		try {
			await onSave({ cfxId, discordId });
		} finally {
			setIsSubmitting(false);
		}
	};

	const isDirty =
		cfxId !== (initialCfxId ?? '') || discordId !== (initialDiscordId ?? '');

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="grid gap-6 sm:grid-cols-2">
				<div className="space-y-2">
					<div className="flex items-center gap-1.5">
						<Label htmlFor="discordId" className="text-sm font-medium">
							Discord ID
						</Label>
						<a
							href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID"
							target="_blank"
							rel="noopener noreferrer"
							title="How to find your Discord ID"
							className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
						>
							<Info className="h-3.5 w-3.5" />
						</a>
					</div>
					<Input
						id="discordId"
						value={discordId}
						onChange={(e) => setDiscordId(e.target.value)}
						placeholder="e.g. 123456789012345678"
						disabled={!canEdit || isSubmitting}
					/>
					<p className="text-xs text-muted-foreground">
						Used for Discord permissions and OAuth.
					</p>
				</div>

				<div className="space-y-2">
					<Label htmlFor="cfxId" className="text-sm font-medium">
						Cfx ID
					</Label>
					<Input
						id="cfxId"
						value={cfxId}
						onChange={(e) => setCfxId(e.target.value)}
						placeholder="e.g. 123456"
						disabled={!canEdit || isSubmitting}
					/>
					<p className="text-xs text-muted-foreground">
						FiveM / RedM Cfx.re account ID.
					</p>
				</div>
			</div>

			{canEdit && (
				<div className="flex justify-end pt-2">
					<Button type="submit" disabled={isSubmitting || !isDirty}>
						{isSubmitting ? 'Saving...' : 'Save Identifiers'}
					</Button>
				</div>
			)}
		</form>
	);
}

function PasswordChangeForm() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (newPassword !== confirmPassword) {
			toast.error('New passwords do not match.');
			return;
		}

		setIsSubmitting(true);
		const passwordPromise = QueryService<ApiResponse<undefined>>({
			endpoint: `/settings/profile/password`,
			method: 'POST',
			body: { currentPassword, newPassword },
		});

		toast.promise(passwordPromise, {
			loading: 'Updating password...',
			success: (r) => {
				if (!r.success) throw new Error(r.error);
				setCurrentPassword('');
				setNewPassword('');
				setConfirmPassword('');
				return 'Password has been successfully updated.';
			},
			error: (err) => {
				console.error('Failed to update password', err.message);
				return `Password update failed: ${err.message}`;
			},
		});

		try {
			await passwordPromise;
		} finally {
			setIsSubmitting(false);
		}
	};

	const isDirty =
		currentPassword.length > 0 ||
		newPassword.length > 0 ||
		confirmPassword.length > 0;

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div className="space-y-4">
				<div>
					<h3 className="text-sm font-semibold">Change Password</h3>
					<p className="text-xs text-muted-foreground">
						Update your panel login password securely.
					</p>
				</div>

				<div className="space-y-4 max-w-xl">
					<div className="space-y-2">
						<Label htmlFor="currentPassword">Current Password</Label>
						<Input
							id="currentPassword"
							type="password"
							value={currentPassword}
							onChange={(e) => setCurrentPassword(e.target.value)}
							placeholder="••••••••••••"
							disabled={isSubmitting}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="newPassword">New Password</Label>
						<Input
							id="newPassword"
							type="password"
							value={newPassword}
							onChange={(e) => setNewPassword(e.target.value)}
							placeholder="••••••••••••"
							disabled={isSubmitting}
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="confirmPassword">Confirm New Password</Label>
						<Input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={(e) => setConfirmPassword(e.target.value)}
							placeholder="••••••••••••"
							disabled={isSubmitting}
						/>
					</div>
				</div>
			</div>

			<div className="flex justify-end pt-2">
				<Button type="submit" disabled={isSubmitting || !isDirty}>
					{isSubmitting ? 'Updating...' : 'Update Password'}
				</Button>
			</div>
		</form>
	);
}

export default function ProfilePage() {
	const navigate = useNavigate();
	const [profileData, setProfileData] = useState<AdminProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		QueryService<ApiResponse<AdminProfile>>({
			endpoint: `/settings/profile`,
			method: 'GET',
		})
			.then((res) => {
				setError(null);
				if (res.success) {
					setProfileData(res.data);
				} else {
					setError(res.error);
				}
			})
			.catch((err) => {
				console.error('Loading profile failed', err.status, err.message);
				setError((err as ApiError).message ?? 'Failed to load profile data.');
			})
			.finally(() => setLoading(false));
	}, []);

	async function handleIdentiferChange(data: {
		cfxId: AdminProfile['cfxId'];
		discordId: AdminProfile['discordId'];
	}) {
		const changePromise = QueryService<
			ApiResponse<{
				newCfxId: AdminProfile['cfxId'];
				newDiscordId: AdminProfile['discordId'];
			}>
		>({
			endpoint: `/settings/profile/identifiers`,
			method: 'POST',
			body: data,
		});

		toast.promise(changePromise, {
			loading: 'Updating player identifiers...',
			success: (r) => {
				if (!r.success) throw new Error(r.error);

				setProfileData((prev) => {
					if (!prev)
						throw new Error('Invalid Action Sequence (no profile data)');

					return {
						...prev,
						cfxId: r.data.newCfxId,
						discordId: r.data.newDiscordId,
					};
				});

				return `Identifiers have been updated.`;
			},
			error: (err) => {
				console.error('Failed to update identifiers', err.message);
				return `Update failed: ${err.message}`;
			},
		});
	}

	if (loading) return <LoadingSkeleton />;

	if (error || !profileData) {
		return (
			<Card className="w-full mt-12">
				<CardContent className="py-6 flex flex-col items-center gap-3 text-center">
					<AlertTriangle className="h-8 w-8 text-destructive" />

					<p className="font-semibold">Failed to load profile</p>
					<p className="text-sm text-muted-foreground">
						{error ?? 'Profile not found.'}
					</p>

					<Button variant="outline" size="sm" onClick={() => navigate(-1)}>
						<ArrowLeft className="h-4 w-4" />
						Go Back
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="flex flex-col h-full p-4 gap-4">
			<div className="flex flex-row justify-between items-center shrink-0">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
						<ArrowLeft className="h-4 w-4" />
					</Button>

					<Avatar className="h-12 w-12 text-base shrink-0">
						<AvatarFallback>{initials(profileData.username)}</AvatarFallback>
					</Avatar>

					<div className="flex-1 min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="text-lg font-bold truncate">
								{profileData.username}
							</h1>
						</div>
						<p className="text-xs text-muted-foreground">
							Profile #{profileData.id}
						</p>
					</div>
				</div>
			</div>

			<div className="flex-1 flex flex-col min-h-0 gap-6">
				<div className="flex flex-wrap gap-3 shrink-0">
					<StatCard
						icon={FileUser}
						label="Linked Player"
						value={
							<PlayerCardContent
								id={profileData.playerId}
								name={profileData.playerName}
							/>
						}
					/>
					<StatCard
						icon={UserPlus}
						label="Created On"
						value={formatDate(profileData.createdAt)}
					/>
					<StatCard
						icon={Clock}
						label="Last Login"
						value={formatDate(profileData.lastLoginAt)}
					/>
					<StatCard
						icon={
							profileData.group?.icon
								? () => (
										<DynamicIcon
											name={profileData.group?.icon as LucidIconName}
											color={profileData.group?.colour}
										/>
									)
								: UsersRound
						}
						className="hidden lg:block"
						label={`Staff Group`}
						value={profileData.group?.name ?? 'Custom'}
					/>
				</div>

				<Tabs defaultValue="activity" className="flex-1 flex flex-col min-h-0">
					<TabsList className="grid w-full grid-cols-4 mb-4">
						<TabsTrigger value="activity">Recent Activity</TabsTrigger>
						<TabsTrigger value="identifiers">Identifiers & Player</TabsTrigger>
						<TabsTrigger value="security">Security</TabsTrigger>
						<TabsTrigger value="settings">Permissions</TabsTrigger>
					</TabsList>

					<TabsContent
						value="activity"
						className="flex-1 flex flex-col min-h-0 mt-0"
					>
						<Card className="flex-1 flex flex-col min-h-0">
							<CardHeader>
								<CardTitle className="text-lg font-bold">
									Action Recap
								</CardTitle>
							</CardHeader>
							<CardContent>
								<ScrollArea className="h-full">
									<div>
										{profileData.auditLogs.length > 0 ? (
											profileData.auditLogs.map((log) => (
												<AuditLogRow key={log.id} log={log} />
											))
										) : (
											<div className="flex flex-col items-center justify-center py-8 px-4 border-2 border-dashed rounded-lg bg-muted/30">
												<Info className="h-8 w-8 text-muted-foreground/60 mb-2" />
												<p className="text-sm font-medium text-muted-foreground">
													No recent activity logs
												</p>
												<p className="text-xs text-muted-foreground/70">
													Actions performed by you will appear here.
												</p>
											</div>
										)}
									</div>
								</ScrollArea>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="identifiers"
						className="flex-1 flex flex-col min-h-0 mt-0 overflow-auto"
					>
						<Card className="flex-1 flex flex-col min-h-0">
							<CardContent className="flex-1 overflow-y-auto">
								<div className="mx-auto w-full max-w-2xl space-y-8">
									<div className="space-y-3 pb-8 border-b">
										<div>
											<h3 className="text-sm font-semibold">
												In-Game Player Account
											</h3>
											<p className="text-xs text-muted-foreground">
												Connect your account to an existing in-game player
												profile.
											</p>
										</div>

										<div className="flex items-center justify-between p-4 rounded-lg border bg-muted/20 gap-4">
											<div className="flex items-center gap-3 min-w-0">
												<FileUser className="h-5 w-5 text-muted-foreground shrink-0" />
												<div className="min-w-0">
													<p className="text-xs text-muted-foreground">
														Linked Player
													</p>
													<PlayerCardContent
														id={profileData.playerId}
														name={profileData.playerName}
													/>
												</div>
											</div>
										</div>
									</div>

									<div className="space-y-4">
										<div>
											<h3 className="text-sm font-semibold">
												External Platform Identifiers
											</h3>
											<p className="text-xs text-muted-foreground">
												Configure third-party IDs linked to your account for
												authentication and bot lookups.
											</p>
										</div>

										<IdentifiersForm
											cfxId={profileData.cfxId}
											discordId={profileData.discordId}
											canEdit={true}
											onSave={handleIdentiferChange}
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="security"
						className="flex-1 flex flex-col min-h-0 mt-0 overflow-auto"
					>
						<Card className="flex-1 flex flex-col min-h-0">
							<CardContent className="flex-1 overflow-y-auto py-6">
								<div className="mx-auto w-full max-w-2xl">
									<PasswordChangeForm />
								</div>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent
						value="settings"
						className="flex-1 flex flex-col min-h-0 mt-0"
					>
						<Card className="flex-1 flex flex-col min-h-0">
							<CardHeader className="shrink-0">
								<CardTitle className="text-lg font-bold">
									Assigned Permissions
								</CardTitle>
							</CardHeader>

							<CardContent className="flex-1 overflow-hidden">
								<PermissionEditor
									editable={false}
									adminId={String(profileData.id)}
									value={profileData.permissions}
									group={profileData.group}
									updatePerms={() => {}}
									updateGroup={() => {}}
								/>
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
