import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Search, RefreshCw, Users } from 'lucide-react';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import type {
	PanelPlayer,
	PlayerActionPayload,
	PlayerActionReply,
} from '@common/types';
import { fetchNui } from '~/utils/fetchNui';
import { showNotification } from '~/store/notifications';

const PREVIEW_PLAYERS: PanelPlayer[] = [
	{ playerId: 1, serverId: 1, name: 'Scorpion', ping: 24, online: true },
	{ playerId: 2, serverId: 12, name: 'Alex Morgan', ping: 48, online: true },
	{
		playerId: 3,
		serverId: 0,
		name: 'Taylor',
		ping: 0,
		online: false,
		lastSeen: Date.now() - 86400000,
	},
];
function lastSeenLabel(value?: number) {
	if (!value || !Number.isFinite(value)) return 'Not recorded';
	return new Date(value).toLocaleString([], {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}
const ACTIONS = [
	{ key: 'warn', label: 'Warn', permission: UserPermissions.WARN },
	{ key: 'kick', label: 'Kick', permission: UserPermissions.KICK },
	{ key: 'ban', label: 'Ban', permission: UserPermissions.BAN },
] as const;

export function PlayersSection({ permissions }: { permissions: number }) {
	const [query, setQuery] = useState('');
	const [scope, setScope] = useState<'online' | 'all'>('online');
	const [players, setPlayers] = useState<PanelPlayer[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [selected, setSelected] = useState<PanelPlayer | null>(null);
	const [action, setAction] = useState<PlayerActionPayload['action']>(
		ACTIONS.find((item) => PermissionManager.has(permissions, item.permission))
			?.key ?? 'warn',
	);
	const [reason, setReason] = useState('');
	const [duration, setDuration] = useState(86400);
	const [pending, setPending] = useState(false);
	const loadSequence = useRef(0);
	const load = useCallback(async () => {
		const sequence = ++loadSequence.current;
		try {
			const data = await fetchNui<PanelPlayer[] | null>(
				'get-players',
				{ query, scope },
				{
					data: PREVIEW_PLAYERS.filter(
						(player) =>
							(scope === 'all' || player.online) &&
							(!query.trim() ||
								player.name
									.toLocaleLowerCase()
									.includes(query.trim().toLocaleLowerCase()) ||
								(player.online && String(player.serverId) === query.trim())),
					),
					delay: 150,
				},
			);
			if (sequence !== loadSequence.current) return;
			if (!data)
				throw new Error(
					'Player list unavailable. Check your permissions and server connection.',
				);
			setPlayers(data);
			setSelected((current) =>
				current
					? (data.find((player) => player.playerId === current.playerId) ??
						null)
					: null,
			);
			setError('');
		} catch (error) {
			if (sequence !== loadSequence.current) return;
			setError(
				error instanceof Error ? error.message : 'Unable to load players.',
			);
		} finally {
			if (sequence === loadSequence.current) setLoading(false);
		}
	}, [query, scope]);
	useEffect(() => {
		let stopped = false;
		let timer: ReturnType<typeof setTimeout>;
		const poll = async () => {
			await load();
			if (!stopped) timer = setTimeout(poll, 5000);
		};
		setLoading(true);
		timer = setTimeout(poll, 300);
		return () => {
			stopped = true;
			clearTimeout(timer);
			++loadSequence.current;
		};
	}, [load]);
	const liveSelected =
		players.find((p) => p.playerId === selected?.playerId) ?? selected;
	const connected = liveSelected?.online === true;

	async function submit() {
		if (
			!selected ||
			pending ||
			(action === 'kick' && !connected) ||
			!reason.trim()
		)
			return;
		setPending(true);
		try {
			const reply = await fetchNui<PlayerActionReply>(
				'player-action',
				{
					playerId: selected.playerId,
					target: liveSelected?.serverId ?? 0,
					action,
					reason: reason.trim(),
					...(action === 'ban' ? { durationSeconds: duration } : {}),
				},
				{
					data: {
						success: false,
						message:
							'Browser preview: moderation requires a connected FiveM server.',
					},
				},
			);
			if (!reply.success) throw new Error(reply.message);
			showNotification({ title: reply.message, variant: 'success' });
			setSelected(null);
			setReason('');
			void load();
		} catch (error) {
			showNotification({
				title: 'Action failed',
				description:
					error instanceof Error ? error.message : 'Server unavailable.',
				variant: 'error',
			});
		} finally {
			setPending(false);
		}
	}
	return (
		<section className="flex flex-col gap-5" aria-label="Player moderation">
			<header className="flex items-center justify-between gap-4">
				<div>
					<h2 className="text-xl font-semibold">
						Players{' '}
						<span className="ml-2 text-sm font-normal text-muted-foreground">
							{scope === 'online' ? 'Online players' : 'Player records'}
						</span>
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{scope === 'online'
							? 'Live connections, vehicle state and vitals.'
							: 'Recent player records, including offline accounts. Search to find a specific player.'}
					</p>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={() => void load()}
					disabled={loading}
				>
					<RefreshCw className="mr-2 size-4" />
					Refresh
				</Button>
			</header>
			<div className="flex flex-wrap items-center gap-3 border-b pb-4">
				<div
					role="group"
					aria-label="Player scope"
					className="flex rounded-md bg-muted p-1"
				>
					{(['online', 'all'] as const).map((value) => (
						<Button
							key={value}
							size="sm"
							variant={scope === value ? 'secondary' : 'ghost'}
							aria-pressed={scope === value}
							disabled={pending}
							onClick={() => {
								setScope(value);
								setSelected(null);
								setReason('');
							}}
						>
							{value === 'online' ? 'Online' : 'All players'}
						</Button>
					))}
				</div>
				<div className="relative min-w-[220px] max-w-lg flex-1">
					<Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
					<Input
						aria-label={
							scope === 'online'
								? 'Search online players'
								: 'Search all player records'
						}
						className="pl-9"
						placeholder={
							scope === 'online'
								? 'Search name or server ID…'
								: 'Search name or identifier…'
						}
						maxLength={100}
						value={query}
						disabled={pending}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</div>
				<span className="ml-auto text-xs text-muted-foreground" role="status">
					{loading
						? 'Searching…'
						: `${players.length} ${players.length === 1 ? 'player' : 'players'}`}
				</span>
			</div>

			{error && (
				<div
					role="alert"
					className="rounded-md border border-destructive p-3 text-sm"
				>
					{error}{' '}
					<Button variant="ghost" size="sm" onClick={() => void load()}>
						Retry
					</Button>
				</div>
			)}
			<div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
				<div className="overflow-x-auto rounded-md border">
					<table className="w-full text-left text-sm">
						<thead className="bg-muted/40 text-muted-foreground">
							<tr>
								<th className="px-4 py-3 font-medium">Player</th>
								<th className="px-4 py-3 font-medium">Status</th>
								{scope === 'online' ? (
									<>
										<th className="px-4 py-3 font-medium">Server ID</th>
										<th className="px-4 py-3 font-medium">Vitals</th>
										<th className="px-4 py-3 font-medium">Ping</th>
									</>
								) : (
									<th className="px-4 py-3 font-medium">Last seen</th>
								)}

								<th className="px-4 py-3">
									<span className="sr-only">Actions</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{players.map((player) => (
								<tr
									key={player.playerId}
									className={`border-t ${selected?.playerId === player.playerId ? 'bg-secondary' : 'hover:bg-muted/30'}`}
								>
									<td className="max-w-[240px] break-words px-4 py-3 font-medium">
										{player.name}
										<span className="mt-1 block font-mono text-xs font-normal text-muted-foreground">
											Player #{player.playerId}
										</span>
									</td>
									<td className="px-4 py-3 text-xs">
										<span
											className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 font-medium ${player.online ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground'}`}
										>
											<span
												aria-hidden="true"
												className={`size-1.5 rounded-full ${player.online ? 'bg-primary' : 'bg-muted-foreground'}`}
											/>
											{player.online ? 'Online' : 'Offline'}
										</span>
										{scope === 'online' && (
											<span className="mt-2 block text-muted-foreground">
												{player.health === undefined
													? 'Spawning'
													: player.health <= 100
														? 'Dead'
														: player.inVehicle
															? 'In vehicle'
															: 'On foot'}{' '}
												· Bucket {player.bucket ?? '—'}
											</span>
										)}
									</td>
									{scope === 'online' ? (
										<>
											<td className="px-4 py-3 font-mono tabular-nums">
												#{player.serverId}
											</td>
											<td className="px-4 py-3 text-xs tabular-nums">
												{player.health === undefined
													? '—'
													: `${Math.max(0, player.health - 100)}/${Math.max(0, (player.maxHealth ?? 200) - 100)} HP`}
												<span className="mt-1 block text-muted-foreground">
													{player.armour ?? 0} armour
												</span>
											</td>
											<td className="px-4 py-3 tabular-nums">
												{player.ping} ms
											</td>
										</>
									) : (
										<td className="px-4 py-3 text-sm text-muted-foreground">
											{player.online ? (
												'Connected now'
											) : (
												<time
													dateTime={
														player.lastSeen && Number.isFinite(player.lastSeen)
															? new Date(player.lastSeen).toISOString()
															: undefined
													}
												>
													{lastSeenLabel(player.lastSeen)}
												</time>
											)}
										</td>
									)}

									<td className="px-4 py-3 text-right">
										<Button
											variant="outline"
											size="sm"
											disabled={pending}
											onClick={() => {
												setSelected(player);
												setAction(
													ACTIONS.find(
														(item) =>
															PermissionManager.has(
																permissions,
																item.permission,
															) &&
															(player.online || item.key !== 'kick'),
													)?.key ?? 'warn',
												);
												setReason('');
											}}
										>
											Manage<span className="sr-only"> {player.name}</span>
										</Button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
					{loading ? (
						<div
							role="status"
							className="animate-pulse p-8 text-sm text-muted-foreground"
						>
							Searching players…
						</div>
					) : (
						!players.length && (
							<div className="p-8 text-center text-sm text-muted-foreground">
								{query
									? 'No players match. Try a name or exact server ID.'
									: scope === 'online'
										? 'No players are connected. Switch to All players to search player history.'
										: 'No player records found.'}
							</div>
						)
					)}
					{scope === 'all' && (
						<p className="border-t px-4 py-3 text-xs text-muted-foreground">
							Includes up to 50 recent database matches plus matching online
							players. Narrow your search to find older accounts.
						</p>
					)}
				</div>
				<aside className="rounded-md border p-4" aria-label="Selected player">
					{!selected ? (
						<div className="flex flex-col gap-3 py-6 text-sm text-muted-foreground">
							<Users className="size-6" />
							<h3 className="font-semibold text-foreground">Select a player</h3>
							<p>
								Choose Manage to warn, kick, or ban. Only actions allowed by
								your role are available.
							</p>
						</div>
					) : (
						<form
							onSubmit={(event) => {
								event.preventDefault();
								void submit();
							}}
							className="flex flex-col gap-4"
						>
							<div>
								<h3 className="break-words text-lg font-semibold">
									{selected.name}
								</h3>
								<p className="text-sm text-muted-foreground">
									{connected
										? `Online · Server ID #${liveSelected?.serverId}`
										: 'Offline'}{' '}
									· Player #{selected.playerId}
								</p>
							</div>
							{liveSelected?.online && (
								<dl className="grid grid-cols-2 gap-3 border-y py-3 text-xs">
									<div>
										<dt className="text-muted-foreground">Health</dt>
										<dd className="mt-1 font-medium">
											{liveSelected.health === undefined
												? '—'
												: Math.max(0, liveSelected.health - 100)}{' '}
											/ {Math.max(0, (liveSelected.maxHealth ?? 200) - 100)}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Armour</dt>
										<dd className="mt-1 font-medium">
											{liveSelected.armour ?? 0}
										</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Connection</dt>
										<dd className="mt-1 font-medium">{liveSelected.ping} ms</dd>
									</div>
									<div>
										<dt className="text-muted-foreground">Routing bucket</dt>
										<dd className="mt-1 font-medium">
											{liveSelected.bucket ?? '—'}
										</dd>
									</div>
								</dl>
							)}
							{!connected && (
								<p className="text-sm text-muted-foreground">
									Last seen: {lastSeenLabel(liveSelected?.lastSeen)}. Kicking
									requires an online player.
								</p>
							)}
							<label className="flex flex-col gap-2 text-sm font-medium">
								Action
								<select
									className="h-10 rounded-md border bg-background px-3"
									value={action}
									disabled={pending}
									onChange={(event) =>
										setAction(
											event.target.value as PlayerActionPayload['action'],
										)
									}
								>
									<option value="" disabled>
										Choose action
									</option>
									{ACTIONS.filter((item) =>
										PermissionManager.has(permissions, item.permission),
									).map((item) => (
										<option
											value={item.key}
											key={item.key}
											disabled={item.key === 'kick' && !connected}
										>
											{item.label}
										</option>
									))}
								</select>
							</label>
							{action === 'ban' && (
								<label className="flex flex-col gap-2 text-sm font-medium">
									Ban duration
									<select
										className="h-10 rounded-md border bg-background px-3"
										value={duration}
										disabled={pending}
										onChange={(event) =>
											setDuration(Number(event.target.value))
										}
									>
										<option value={3600}>1 hour</option>
										<option value={86400}>1 day</option>
										<option value={604800}>7 days</option>
										<option value={2592000}>30 days</option>
										<option value={0}>Permanent</option>
									</select>
								</label>
							)}
							<label className="flex flex-col gap-2 text-sm font-medium">
								Reason
								<textarea
									required
									maxLength={500}
									rows={4}
									className="resize-y rounded-md border bg-background p-3 font-normal"
									placeholder="Explain the rule violation…"
									value={reason}
									disabled={pending}
									onChange={(event) => setReason(event.target.value)}
								/>
							</label>
							<p className="text-xs text-muted-foreground">
								{action === 'warn'
									? 'Records a warning in the player history.'
									: action === 'kick'
										? 'Disconnects this player immediately.'
										: `Disconnects this player and blocks rejoining ${duration === 0 ? 'permanently' : 'for the selected duration'}.`}{' '}
								Your action and reason are recorded.
							</p>
							<Button
								type="submit"
								variant={action === 'warn' ? 'default' : 'destructive'}
								disabled={
									pending ||
									(action === 'kick' && !connected) ||
									!reason.trim() ||
									!ACTIONS.some(
										(item) =>
											item.key === action &&
											PermissionManager.has(permissions, item.permission),
									)
								}
							>
								{pending ? 'Submitting…' : `Confirm ${action}`}
							</Button>
							<Button
								type="button"
								variant="ghost"
								disabled={pending}
								onClick={() => setSelected(null)}
							>
								Cancel
							</Button>
						</form>
					)}
				</aside>
			</div>
		</section>
	);
}
