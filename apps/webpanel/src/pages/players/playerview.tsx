import { QueryService } from '@/lib/query';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@fxmanager/ui/components/avatar';
import { Badge } from '@fxmanager/ui/components/badge';
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
	Ban,
	Clock,
	Fingerprint,
	Flag,
	Gavel,
	Hammer,
	ShieldCheck,
	StickyNote,
	User,
} from 'lucide-react';
import {
	copyToClipboard,
	formatDate,
	formatDuration,
	initials,
} from '@/lib/utils';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { Button } from '@fxmanager/ui/components/button';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import {
	AdminProfile,
	BansTab,
	KicksTab,
	NotesTab,
	ReportsTab,
	SessionsTab,
	WarnsTab,
} from './components/tab-elements';
import { ActivityHeatmap } from './components/activity-heatmap';
import { usePlayerAction } from '@/hooks/use-player-actions';
import {
	PlayerActionDialog,
	type ActionTab,
} from '@/components/player-actions-dialog';
import type { ApiError, ApiResponse } from '@fxmanager/shared/types';
import type { PlayerProfile } from '@fxmanager/database/types';
import { StatCard } from '@/components/stat-card';

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
					<Skeleton key={i} className="h-16 flex-1 min-w-[140px] rounded-lg" />
				))}
			</div>

			{/* tabs */}
			<Skeleton className="h-10 w-full rounded-md" />
			<Skeleton className="h-48 w-full rounded-lg" />
		</div>
	);
}

export default function PlayerView() {
	const navigate = useNavigate();
	const params = useParams<{ playerId: string }>();
	const { dialogOpen, dialogPlayer, openAction, closeAction } =
		usePlayerAction();
	const [actionTab, setActionTab] = useState<ActionTab>('warn');
	const [playerData, setPlayerData] = useState<PlayerProfile | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!params.playerId) return;

		QueryService<ApiResponse<PlayerProfile>>({
			endpoint: `/players/${params.playerId}`,
			method: 'GET',
		})
			.then((res) => {
				setError(null);
				if (res.success) {
					setPlayerData(res.data);
				} else {
					setError(res.error);
				}
			})
			.catch((err) => {
				console.error('Loading player failed', err.status, err.message);
				setError((err as ApiError).message ?? 'Failed to load player data.');
			})
			.finally(() => setLoading(false));
	}, [params.playerId]);

	const refetch = useCallback(() => {
		if (!params.playerId) return;

		QueryService<ApiResponse<PlayerProfile>>({
			endpoint: `/players/${params.playerId}`,
			method: 'GET',
		}).then((res) => {
			if (res.success) setPlayerData(res.data);
		});
	}, [params.playerId]);

	function handleTabChange(tab: string) {
		if (tab === 'report' || tab === 'session') return;

		setActionTab(tab as ActionTab);
	}

	if (loading) return <LoadingSkeleton />;

	if (error || !playerData) {
		return (
			<Card className="w-full mt-12">
				<CardContent className="py-6 flex flex-col items-center gap-3 text-center">
					<AlertTriangle className="h-8 w-8 text-destructive" />

					<p className="font-semibold">Failed to load player</p>
					<p className="text-sm text-muted-foreground">
						{error ?? 'Player not found.'}
					</p>

					<Button variant="outline" size="sm" asChild>
						<Link to="/players">
							<ArrowLeft className="h-4 w-4" />
							Back to Players
						</Link>
					</Button>
				</CardContent>
			</Card>
		);
	}

	const { punishments } = playerData;
	const totalPunishments =
		punishments.bans.length +
		punishments.warns.length +
		punishments.kicks.length;

	return (
		<div>
			<div className="flex items-center gap-3 my-4">
				<Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
					<ArrowLeft className="h-4 w-4" />
				</Button>

				<Avatar className="h-12 w-12 text-base shrink-0">
					<AvatarFallback>{initials(playerData.name)}</AvatarFallback>
				</Avatar>

				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-lg font-bold truncate">{playerData.name}</h1>
						{playerData.isStaff && (
							<Badge variant="secondary" className="gap-1">
								<ShieldCheck className="h-3 w-3" />
								Staff
							</Badge>
						)}
					</div>
					<p className="text-xs text-muted-foreground">
						Player #{playerData.id}
					</p>
				</div>

				<Button
					variant="outline"
					size="icon"
					title="Open Actions"
					className="mr-4"
					onClick={() => openAction(playerData)}
				>
					<Gavel className="h-4 w-4" />
				</Button>
			</div>

			<ScrollArea className="h-[calc(100vh-7rem)]">
				<div className="space-y-6 pt-2 pb-0 pl-0 pr-4">
					<div className="flex flex-wrap gap-3">
						<StatCard
							icon={Clock}
							label="Playtime"
							value={formatDuration(playerData.playtime)}
						/>
						<StatCard
							icon={User}
							label="First Seen"
							value={formatDate(playerData.firstSeen)}
						/>
						<StatCard
							icon={User}
							label="Last Seen"
							value={formatDate(playerData.lastSeen)}
						/>
						<StatCard
							icon={Hammer}
							label="Punishments"
							value={
								totalPunishments > 0 ? (
									<span className="text-destructive">{totalPunishments}</span>
								) : (
									'None'
								)
							}
						/>
					</div>

					<ActivityHeatmap playerId={playerData.id} />

					<Card>
						<CardHeader className="pb-2 pt-4 px-4">
							<CardTitle className="text-sm flex items-center gap-2">
								<Fingerprint className="h-4 w-4" />
								Identifiers
							</CardTitle>
						</CardHeader>
						<CardContent className="px-4 pb-4">
							<div className="flex flex-wrap gap-2">
								{Object.entries(playerData.identifiers).map(([key, value]) =>
									value ? (
										<Badge
											key={key}
											variant="outline"
											className="font-mono text-xs cursor-pointer"
											onClick={() => copyToClipboard(value)}
										>
											{value}
										</Badge>
									) : null,
								)}
							</div>
						</CardContent>
					</Card>

					<AdminProfile adminProfile={playerData.adminProfile} />

					<Tabs defaultValue="ban" onValueChange={handleTabChange}>
						<TabsList className="w-full justify-start flex-wrap h-auto">
							<TabsTrigger value="ban" className="gap-1.5">
								<Ban className="h-3.5 w-3.5" />
								Bans
								{punishments.bans.length > 0 && (
									<Badge
										variant="destructive"
										className="ml-1 px-1.5 py-0 text-xs h-4"
									>
										{punishments.bans.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="kick" className="gap-1.5">
								<Hammer className="h-3.5 w-3.5" />
								Kicks
								{punishments.kicks.length > 0 && (
									<Badge
										variant="secondary"
										className="ml-1 px-1.5 py-0 text-xs h-4"
									>
										{punishments.kicks.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="warn" className="gap-1.5">
								<AlertTriangle className="h-3.5 w-3.5" />
								Warns
								{punishments.warns.length > 0 && (
									<Badge
										variant="secondary"
										className="ml-1 px-1.5 py-0 text-xs h-4"
									>
										{punishments.warns.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="report" className="gap-1.5">
								<Flag className="h-3.5 w-3.5" />
								Reports
								{playerData.reports.length > 0 && (
									<Badge
										variant="secondary"
										className="ml-1 px-1.5 py-0 text-xs h-4"
									>
										{playerData.reports.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="note" className="gap-1.5">
								<StickyNote className="h-3.5 w-3.5" />
								Notes
								{playerData.notes.length > 0 && (
									<Badge
										variant="secondary"
										className="ml-1 px-1.5 py-0 text-xs h-4"
									>
										{playerData.notes.length}
									</Badge>
								)}
							</TabsTrigger>
							<TabsTrigger value="session" className="gap-1.5">
								<Clock className="h-3.5 w-3.5" />
								Sessions
							</TabsTrigger>
						</TabsList>

						<TabsContent value="ban" className="mt-4">
							<Card>
								<CardContent className="p-0 overflow-auto">
									<BansTab
										bans={punishments.bans}
										playerId={playerData.id}
										onRevoked={refetch}
									/>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="warn" className="mt-4">
							<Card>
								<CardContent className="p-0 overflow-auto">
									<WarnsTab
										warns={punishments.warns}
										playerId={playerData.id}
										onRevoked={refetch}
									/>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="kick" className="mt-4">
							<Card>
								<CardContent className="p-0 overflow-auto">
									<KicksTab
										kicks={punishments.kicks}
										playerId={playerData.id}
										onRevoked={refetch}
									/>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="report" className="mt-4">
							<Card>
								<CardContent className="p-0 overflow-auto">
									<ReportsTab reports={playerData.reports} />
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="note" className="mt-4">
							<Card>
								<CardContent className="p-0 overflow-auto">
									<NotesTab notes={playerData.notes} />
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="session" className="mt-4">
							<Card>
								<CardContent className="p-0 overflow-auto">
									<SessionsTab playerId={playerData.id} />
								</CardContent>
							</Card>
						</TabsContent>
					</Tabs>
				</div>

				<PlayerActionDialog
					player={dialogPlayer}
					open={dialogOpen}
					defaultTab={actionTab}
					onClose={closeAction}
					onSuccess={refetch}
				/>
			</ScrollArea>
		</div>
	);
}
