import { useEffect, useMemo, useState } from 'react';
import {
	Activity,
	ArrowRight,
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Clock,
	Hourglass,
	Timer,
} from 'lucide-react';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import { Button } from '@fxmanager/ui/components/button';
import type { ApiResponse, PlayerActivity } from '@fxmanager/shared/types';
import { QueryService } from '@/lib/query';
import { formatDuration } from '@/lib/utils';
import { StatCard } from '@/components/stat-card';

const WINDOW = 30;
const MONTHS = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
];
const pad = (n: number) => String(n).padStart(2, '0');
const keyOf = (d: Date) =>
	`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfDay = (d: Date) =>
	new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) =>
	new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const shortLabel = (key: string) => {
	const [, m, dd] = key.split('-');
	return `${Number(dd)} ${MONTHS[Number(m) - 1]}`;
};

// Sequential single-hue (amber, theme --primary) magnitude ramp. Light + dark
// steps are validated with dataviz `validate_palette --ordinal`: monotone
// lightness, ΔL ≥ 0.06, one hue, and the palest step clears 2:1 on its surface.
const LEVEL_CLASS = [
	'bg-muted',
	'bg-[#dda544] dark:bg-[#805529]',
	'bg-[#c9862b] dark:bg-[#a06a30]',
	'bg-[#ac6c1a] dark:bg-[#c48843]',
	'bg-[#8a520e] dark:bg-[#e6ab5e]',
];
function level(ms: number): number {
	if (ms <= 0) return 0;
	if (ms < 3_600_000) return 1;
	if (ms < 10_800_000) return 2;
	if (ms < 21_600_000) return 3;
	return 4;
}

type Day = { date: string; playtimeMs: number; sessionCount: number };

export function ActivityHeatmap({ playerId }: { playerId: number }) {
	const [offset, setOffset] = useState(0); // windows back from today
	const [data, setData] = useState<PlayerActivity | null>(null);
	const [loading, setLoading] = useState(true);
	const [hovered, setHovered] = useState<number | null>(null);

	const { from, to } = useMemo(() => {
		const toDate = startOfDay(addDays(new Date(), -offset * WINDOW));
		return { from: addDays(toDate, -(WINDOW - 1)), to: toDate };
	}, [offset]);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		const params = new URLSearchParams({ from: keyOf(from), to: keyOf(to) });
		QueryService<ApiResponse<PlayerActivity>>({
			endpoint: `/players/${playerId}/activity?${params}`,
			method: 'GET',
		})
			.then((res) => {
				if (!cancelled && res.success) setData(res.data);
			})
			.catch((err) => console.error('Loading activity failed', err))
			.finally(() => !cancelled && setLoading(false));
		return () => {
			cancelled = true;
		};
	}, [playerId, from, to]);

	const days = useMemo<Day[]>(() => {
		const map = new Map(data?.days.map((d) => [d.date, d]) ?? []);
		const out: Day[] = [];
		for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
			const a = map.get(keyOf(d));
			out.push({
				date: keyOf(d),
				playtimeMs: a?.playtimeMs ?? 0,
				sessionCount: a?.sessionCount ?? 0,
			});
		}
		return out;
	}, [data, from, to]);

	const maxMs = useMemo(
		() => Math.max(1, ...days.map((d) => d.playtimeMs)),
		[days],
	);

	const s = data?.summary;
	const isEmpty = !loading && s && s.daysActive === 0;
	const active = hovered != null ? days[hovered] : null;

	return (
		<Card>
			<CardHeader className="py-2 px-4 flex-row items-center justify-between gap-2">
				<CardTitle className="text-sm flex items-center gap-2 shrink-0">
					<Activity className="h-4 w-4" />
					Activity - last {WINDOW} days
				</CardTitle>
				<div className="flex items-center gap-3 min-w-0">
					<div className="flex items-center gap-1 shrink-0">
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							title="Earlier window"
							onClick={() => setOffset((o) => o + 1)}
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
						<span className="text-xs text-muted-foreground truncate tabular-nums">
							{active ? (
								`${shortLabel(active.date)} · ${
									active.playtimeMs > 0
										? `${formatDuration(active.playtimeMs)} · ${active.sessionCount} session${active.sessionCount > 1 ? 's' : ''}`
										: 'no activity'
								}`
							) : (
								<>
									{keyOf(from)}
									<ArrowRight className="inline mx-1 h-3 w-3 align-middle" />
									{keyOf(to)}
								</>
							)}
						</span>
						<Button
							variant="ghost"
							size="icon"
							className="h-7 w-7"
							title="Later window"
							disabled={offset === 0}
							onClick={() => setOffset((o) => Math.max(0, o - 1))}
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 space-y-4">
				<div className="flex flex-wrap gap-3">
					<StatCard
						icon={CalendarDays}
						label="Days active"
						value={`${s?.daysActive ?? 0} / ${WINDOW}`}
					/>
					<StatCard
						icon={Clock}
						label="Playtime"
						value={formatDuration(s?.totalPlaytimeMs ?? 0)}
					/>
					<StatCard
						icon={Hourglass}
						label="Longest"
						value={formatDuration(s?.longestSessionMs ?? 0)}
					/>
					<StatCard
						icon={Timer}
						label="Avg session"
						value={formatDuration(s?.avgSessionMs ?? 0)}
					/>
				</div>

				{isEmpty ? (
					<div className="flex flex-col items-center justify-center gap-2 h-48 text-muted-foreground">
						<Activity className="h-8 w-8 opacity-30" />
						<p className="text-xs">
							No activity in this window — history collects going forward.
						</p>
					</div>
				) : (
					<div>
						{/* biome-ignore lint/a11y/noStaticElementInteractions: chart hover, not an interactive control */}
						<div
							className="h-48 flex items-end gap-[3px]"
							onMouseLeave={() => setHovered(null)}
						>
							{days.map((d, i) => {
								const pct =
									d.playtimeMs > 0
										? Math.max(6, (d.playtimeMs / maxMs) * 100)
										: 0;
								const dimmed = hovered != null && hovered !== i;
								return (
									// biome-ignore lint/a11y/noStaticElementInteractions: chart column hover
									<div
										key={d.date}
										className="flex-1 min-w-0 h-full flex flex-col justify-end cursor-default"
										onMouseEnter={() => setHovered(i)}
										title={`${d.date}: ${
											d.playtimeMs > 0
												? `${formatDuration(d.playtimeMs)} · ${d.sessionCount} session(s)`
												: 'no activity'
										}`}
									>
										<div
											className={`w-full rounded-t-sm ring-1 ring-inset ring-foreground/[0.06] transition-opacity ${LEVEL_CLASS[level(d.playtimeMs)]} ${dimmed ? 'opacity-50' : 'opacity-100'}`}
											style={{ height: d.playtimeMs > 0 ? `${pct}%` : '3px' }}
										/>
									</div>
								);
							})}
						</div>
						<div className="mt-1.5 flex gap-[3px] border-t border-border/60 pt-1.5">
							{days.map((d, i) => (
								<div
									key={d.date}
									className="flex-1 min-w-0 text-center text-[10px] leading-none text-muted-foreground tabular-nums whitespace-nowrap"
								>
									{i % 5 === 0 ? shortLabel(d.date) : ''}
								</div>
							))}
						</div>
					</div>
				)}

				<div className="flex items-center gap-1 justify-end text-xs text-muted-foreground">
					Less
					{LEVEL_CLASS.map((c) => (
						<span
							key={c}
							className={`h-3 w-3 rounded-sm ring-1 ring-inset ring-foreground/[0.06] ${c}`}
						/>
					))}
					More
				</div>
			</CardContent>
		</Card>
	);
}
