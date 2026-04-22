import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@fxmanager/ui/components/table';
import {
	BookUser,
	Clock,
	Heart,
	Shield,
	ShieldAlert,
	Wifi,
	WifiOff,
} from 'lucide-react';
import { formatDuration } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { useNavigate } from 'react-router-dom';
import { Card } from '@fxmanager/ui/components/card';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { Button } from '@fxmanager/ui/components/button';
import { Skeleton } from '@fxmanager/ui/components/skeleton';
import { PlayerActionDialog } from '@/components/player-actions-dialog';
import { usePlayerAction } from '@/hooks/use-player-actions';
import { usePlayerlistSocket } from '@/hooks/ws-channels';

// region helpers

/** Format a Date (or ISO string) to a short locale time, e.g. "14:07" */
function formatJoinTime(date: Date | string): string {
	return new Date(date).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
	});
}

/** Map a 0-200 health value to a semantic colour class */
function healthColor(health: number): string {
	if (health > 150) return 'text-emerald-400';
	if (health > 100) return 'text-yellow-400';
	if (health > 50) return 'text-orange-400';
	return 'text-red-500';
}

/** Return a width percentage string for the health bar (0-200 range → 0-100%) */
function healthBarWidth(health: number): string {
	return `${Math.min(100, Math.max(0, (health / 200) * 100))}%`;
}

/** Map a ping value to a colour class */
function pingColor(ping?: number): string {
	if (ping === undefined) return 'text-zinc-500';
	if (ping < 80) return 'text-emerald-400';
	if (ping < 150) return 'text-yellow-400';
	return 'text-red-500';
}

// region mockdata

// import type { OnlinePlayer } from '@fxmanager/shared/types';
// const players: OnlinePlayer[] = [
// 	{
// 		id: 1,
// 		serverId: 1,
// 		name: 'Haruto_K',
// 		isStaff: true,
// 		health: 196,
// 		playtime: 312,
// 		ping: 42,
// 		firstSeen: new Date('2025-01-15T08:00:00'),
// 		lastSeen: new Date('2025-03-20T09:14:00'),
// 		identifiers: {
// 			license: 'license:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
// 			fivem: 'fivem:123456',
// 			discord: 'discord:198765432101234567',
// 		},
// 	},
// 	{
// 		id: 2,
// 		serverId: 4,
// 		name: 'xXSn1perXx',
// 		isStaff: false,
// 		health: 134,
// 		playtime: 47,
// 		ping: 88,
// 		firstSeen: new Date('2025-03-20T11:45:00'),
// 		lastSeen: new Date('2025-03-20T11:52:00'),
// 		identifiers: {
// 			license: 'license:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3',
// 			steam: 'steam:110000112345678',
// 		},
// 	},
// 	{
// 		id: 3,
// 		serverId: 7,
// 		name: 'Mireille_D',
// 		isStaff: true,
// 		health: 82,
// 		playtime: 1430,
// 		ping: 61,
// 		firstSeen: new Date('2024-06-10T10:00:00'),
// 		lastSeen: new Date('2025-03-20T08:01:00'),
// 		identifiers: {
// 			license: 'license:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
// 			fivem: 'fivem:654321',
// 			discord: 'discord:876543219876543210',
// 			steam: 'steam:110000198765432',
// 		},
// 	},
// 	{
// 		id: 4,
// 		serverId: 12,
// 		name: 'BigDaddyJ',
// 		isStaff: false,
// 		health: 38,
// 		playtime: 9,
// 		ping: 204,
// 		firstSeen: new Date('2025-03-20T13:00:00'),
// 		lastSeen: new Date('2025-03-20T13:07:00'),
// 		identifiers: {
// 			license: 'license:d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5',
// 		},
// 	},
// 	{
// 		id: 5,
// 		serverId: 19,
// 		name: 'nova_404',
// 		isStaff: false,
// 		health: 165,
// 		playtime: 228,
// 		ping: 73,
// 		firstSeen: new Date('2025-02-28T09:00:00'),
// 		lastSeen: new Date('2025-03-20T10:33:00'),
// 		identifiers: {
// 			license: 'license:e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6',
// 			discord: 'discord:112233445566778899',
// 			steam: 'steam:110000111223344',
// 		},
// 	},
// ];

// region main component

const COL_GRID = 'grid-cols-[3rem_1fr_1fr_1fr_1fr_1fr_8rem]';

export default function PlayerListPage() {
	const navigate = useNavigate();
	const { dialogOpen, dialogPlayer, dialogTab, openAction, closeAction } =
		usePlayerAction();
	const { players, loading } = usePlayerlistSocket();

	return (
		<div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
			<PageHeader
				Icon={BookUser}
				title="Player List"
				description="Current connected players on the server."
			/>
			<Card className="bg-card/50 py-0">
				<div className="overflow-hidden rounded-t-lg">
					<Table className="w-full">
						<TableHeader className="bg-card block w-full">
							<TableRow className={`grid ${COL_GRID} w-full`}>
								<TableHead className="flex items-center">#</TableHead>
								<TableHead className="flex items-center">Player</TableHead>
								<TableHead className="flex items-center">Health</TableHead>
								<TableHead className="flex items-center">
									<span className="flex items-center gap-1.5">
										<Clock className="w-3 h-3" /> Playtime
									</span>
								</TableHead>
								<TableHead className="flex items-center">Joined</TableHead>
								<TableHead className="flex items-center">
									<span className="flex items-center gap-1.5">
										<Wifi className="w-3 h-3" /> Ping
									</span>
								</TableHead>
								<TableHead className="flex items-center" />
							</TableRow>
						</TableHeader>

						<TableBody className="block w-full">
							<ScrollArea className="h-[65vh]">
								{loading ? (
									Array.from({ length: 6 }).map((_, i) => (
										<TableRow key={i} className={`grid ${COL_GRID} w-full`}>
											{Array.from({ length: 7 }).map((_, j) => (
												<TableCell key={j}>
													<Skeleton className="h-4 w-full bg-zinc-800 rounded" />
												</TableCell>
											))}
										</TableRow>
									))
								) : players.length === 0 ? (
									<TableRow className="w-full hover:bg-transparent">
										<TableCell className="text-center text-zinc-600 py-12 text-sm block w-full">
											No players currently online.
										</TableCell>
									</TableRow>
								) : (
									players.map((p) => (
										<TableRow
											key={p.serverId}
											className={`grid ${COL_GRID} w-full border-zinc-800/60 hover:bg-zinc-900/50 transition-colors group cursor-pointer`}
											onClick={() => navigate(`/players/${p.id}`)}
										>
											<TableCell className="flex items-center text-zinc-600 text-xs font-mono">
												{p.serverId}
											</TableCell>

											<TableCell className="flex items-center">
												<div className="flex items-center gap-2">
													<span className="text-zinc-100 text-sm font-medium leading-none">
														{p.name}
													</span>
													{p.isStaff && (
														<Shield className="w-3.5 h-3.5 text-sky-400 shrink-0" />
													)}
												</div>
											</TableCell>

											<TableCell className="flex items-center">
												<div className="flex items-center gap-2 w-full">
													<Heart
														className={`w-3.5 h-3.5 shrink-0 ${healthColor(p.health)}`}
													/>
													<div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
														<div
															className={`h-full rounded-full transition-all duration-500 ${
																p.health > 150
																	? 'bg-emerald-500'
																	: p.health > 100
																		? 'bg-yellow-500'
																		: p.health > 50
																			? 'bg-orange-500'
																			: 'bg-red-600'
															}`}
															style={{ width: healthBarWidth(p.health) }}
														/>
													</div>
													<span
														className={`text-xs font-mono tabular-nums w-8 text-right ${healthColor(p.health)}`}
													>
														{p.health}
													</span>
												</div>
											</TableCell>

											<TableCell className="flex items-center text-zinc-300 text-sm font-mono tabular-nums">
												{formatDuration(p.playtime)}
											</TableCell>

											<TableCell className="flex items-center text-zinc-400 text-sm tabular-nums">
												{formatJoinTime(p.lastSeen)}
											</TableCell>

											<TableCell className="flex items-center">
												{p.ping !== undefined ? (
													<span
														className={`text-sm font-mono tabular-nums flex items-center gap-1 ${pingColor(p.ping)}`}
													>
														{p.ping < 150 ? (
															<Wifi className="w-3 h-3" />
														) : (
															<WifiOff className="w-3 h-3" />
														)}
														{p.ping}
														<span className="text-zinc-600 text-xs">ms</span>
													</span>
												) : (
													<span className="text-zinc-600 text-xs">—</span>
												)}
											</TableCell>

											<TableCell className="flex items-center justify-center">
												<Button
													size="sm"
													variant="outline"
													className="h-7"
													onClick={(e) => {
														e.stopPropagation();
														openAction(p);
													}}
												>
													<ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Actions
												</Button>
											</TableCell>
										</TableRow>
									))
								)}
							</ScrollArea>
						</TableBody>
					</Table>
				</div>
			</Card>

			<PlayerActionDialog
				player={dialogPlayer}
				open={dialogOpen}
				defaultTab={dialogTab}
				onClose={closeAction}
			/>
		</div>
	);
}
