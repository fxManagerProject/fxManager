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
	AlertTriangle,
	ArrowLeft,
	Clock,
	FileUser,
	Gavel,
	Info,
	UserPlus,
} from 'lucide-react';
import { formatDate, initials } from '@/lib/utils';
import { Button } from '@fxmanager/ui/components/button';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import type { ApiError, ApiResponse } from '@fxmanager/shared/types';
import { StatCard } from '@/components/stat-card';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import type { AdminProfile } from '@fxmanager/database/types';
import PermissionEditor from './components/permissioneditor';

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
					<Skeleton key={i} className="h-24 flex-1 min-w-[140px] rounded-lg" />
				))}
			</div>

			{/*  tabs*/}
			<Skeleton className="h-10 w-full rounded-md" />
			<Skeleton className="h-48 w-full rounded-lg" />
		</div>
	);
}

export default function AdminView() {
	const navigate = useNavigate();
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
					console.log(res);
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

	if (loading) return <LoadingSkeleton />;

	if (error || !adminData) {
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

	const { stats } = adminData;
	const totalActions = stats.totalBans + stats.totalKicks + stats.totalWarns;

	return (
		<div>
			<div className="flex items-center gap-3 my-4">
				<Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
					<ArrowLeft className="h-4 w-4" />
				</Button>

				<Avatar className="h-12 w-12 text-base shrink-0">
					<AvatarFallback>{initials(adminData.username)}</AvatarFallback>
				</Avatar>

				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h1 className="text-lg font-bold truncate">{adminData.username}</h1>
					</div>
					<p className="text-xs text-muted-foreground">Admin #{adminData.id}</p>
				</div>
			</div>

			<div className="space-y-6 pt-2 pb-0 pl-0 pr-4">
				<div className="flex flex-wrap gap-3 flex-col md:flex-row">
					<StatCard
						icon={FileUser}
						label="Linked Player"
						value={
							<p className="font-mono">{adminData.playerId ?? 'Unlinked'}</p>
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
						icon={Gavel}
            className='hidden lg:block'
						label={`Action Distribution (total: ${totalActions})`}
						value={
							<div className="mt-1">
								<div className="flex h-2 w-full overflow-hidden rounded-full bg-secondary">
									<div
										style={{
											width: `${(stats.totalBans / totalActions) * 100}%`,
										}}
										className="bg-red-500"
									/>
									<div
										style={{
											width: `${(stats.totalKicks / totalActions) * 100}%`,
										}}
										className="bg-orange-500"
									/>
									<div
										style={{
											width: `${(stats.totalWarns / totalActions) * 100}%`,
										}}
										className="bg-yellow-500"
									/>
								</div>
								<div className="mt-1 flex justify-around text-[10px] uppercase text-muted-foreground">
									<span>Bans: {stats.totalBans}</span>
									<span>Kicks: {stats.totalKicks}</span>
									<span>Warns: {stats.totalWarns}</span>
								</div>
							</div>
						}
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
									<div className="">
										{adminData.auditLogs.length > 0 ? (
											adminData.auditLogs.map((log) => (
												<div
													key={log.id}
													className="flex justify-between items-start border-b py-3 last:border-0 hover:bg-muted/20 transition-colors mr-4"
												>
													<div className="space-y-1">
														<div className="flex items-center gap-2">
															<span className="text-sm font-semibold uppercase tracking-wide">
																{log.action.replace('_', ' ')}
															</span>
															{log.target && (
																<>
																	<span className="text-muted-foreground text-xs">
																		→
																	</span>
																	<span className="text-xs font-mono bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">
																		{log.target}
																	</span>
																</>
															)}
														</div>

														{log.metadata &&
															Object.keys(log.metadata).length > 0 && (
																<p className="text-xs text-muted-foreground italic">
																	{Object.entries(log.metadata)
																		.map(([key, val]) => `${key}: ${val}`)
																		.join(' | ')}
																</p>
															)}
													</div>

													<div className="flex flex-col justify-center items-end gap-1 self-stretch">
														<span className="text-xs text-muted-foreground">
															{formatDate(log.createdAt)}
														</span>
													</div>
												</div>
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
								</ScrollArea>
							</CardContent>
						</Card>
					</TabsContent>

					<TabsContent value="settings">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg font-bold">
									Permissions Editor
								</CardTitle>
							</CardHeader>
							<CardContent>
                <PermissionEditor value={adminData.permissions} />
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</div>
		</div>
	);
}
