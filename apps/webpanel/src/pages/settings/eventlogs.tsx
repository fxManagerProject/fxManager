import {
	BadgeInfo,
	Calendar as CalendarIcon,
	Filter,
	ListEnd,
	X,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { useEffect, useMemo, useState } from 'react';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { Button } from '@fxmanager/ui/components/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@fxmanager/ui/components/popover';
import { Badge } from '@fxmanager/ui/components/badge';
import { useDebounce } from '@/hooks/use-debounce';
import { Calendar } from '@fxmanager/ui/components/calendar';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useEventLogsSocket } from '@/hooks/ws-channels';
import type { EventLogEntry } from '@fxmanager/shared/types';

function formatTimestamp(ts: number): string {
	return format(new Date(ts * 1000), 'MMM dd, yyyy HH:mm:ss');
}

function EventLogRow({ entry }: { entry: EventLogEntry }) {
	return (
		<div className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors">
			<div className="flex shrink-0 mt-0.5">
				<Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
					{entry.event}
				</Badge>
			</div>

			<div className="flex-1 min-w-0 space-y-0.5">
				<div className="flex items-center gap-2 flex-wrap">
					{entry.playerName && (
						<span className="font-medium text-sm">{entry.playerName}</span>
					)}
					{entry.playerId !== undefined && (
						<span className="text-xs text-muted-foreground tabular-nums">
							#{entry.playerId}
						</span>
					)}
				</div>

				{Object.keys(entry.data).length > 0 && (
					<div className="text-xs text-muted-foreground font-mono break-all">
						{Object.entries(entry.data).map(([key, value]) => (
							<span key={key} className="inline-block mr-2">
								<span className="text-foreground/60">{key}</span>=
								<span>{JSON.stringify(value)}</span>
							</span>
						))}
					</div>
				)}
			</div>

			<div className="shrink-0 text-xs text-muted-foreground/70 tabular-nums pt-0.5">
				{formatTimestamp(entry.timestamp)}
			</div>
		</div>
	);
}

/** Extract unique event type names from the current entries for filter suggestions. */
function useEventTypeSuggestions(entries: EventLogEntry[]): string[] {
	return useMemo(() => {
		const seen = new Set<string>();
		for (const e of entries) seen.add(e.event);
		return [...seen].sort();
	}, [entries]);
}

export default function EventLogsPage() {
	const { entries, loading, filtered } = useEventLogsSocket({
		maxEntries: 2000,
	});

	const [searchEvent, setSearchEvent] = useState('');
	const [searchPlayer, setSearchPlayer] = useState('');
	const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
	const [paused, setPaused] = useState(false);

	const debouncedEvent = useDebounce(searchEvent, 300);
	const debouncedPlayer = useDebounce(searchPlayer, 300);

	const suggestions = useEventTypeSuggestions(entries);

	// Derive the effective display list — start from the WS hook's filtered (which
	// applies any setFilter callback) and add client-side filters for event / player / date.
	const display = useMemo(() => {
		let list = paused ? [...entries] : filtered;

		if (debouncedEvent.trim()) {
			const lower = debouncedEvent.trim().toLowerCase();
			list = list.filter((e) => e.event.toLowerCase().includes(lower));
		}

		if (debouncedPlayer.trim()) {
			const lower = debouncedPlayer.trim().toLowerCase();
			list = list.filter(
				(e) =>
					e.playerName?.toLowerCase().includes(lower) ||
					e.playerId?.toString().includes(lower),
			);
		}

		if (dateRange?.from) {
			const from = dateRange.from.getTime() / 1000;
			list = list.filter((e) => e.timestamp >= from);
		}
		if (dateRange?.to) {
			const to = dateRange.to.getTime() / 1000 + 86400; // end of day
			list = list.filter((e) => e.timestamp <= to);
		}

		return list;
	}, [entries, filtered, debouncedEvent, debouncedPlayer, dateRange, paused]);

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<PageHeader
				Icon={ListEnd}
				title="Event Logs"
				description="Live feed of game events — player joins, deaths, teleports, and more."
			/>

			<div className="flex flex-wrap justify-between items-end border-b border-border/60 pb-4 mt-2">
				<div className="flex flex-wrap items-end gap-4">
					{/* Event type filter */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Event Type
						</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className="h-9 w-60 justify-between text-left font-normal bg-background"
								>
									{searchEvent || (
										<span className="text-muted-foreground">
											All event types…
										</span>
									)}
									{searchEvent && (
										<span className="truncate">{searchEvent}</span>
									)}
									<Filter className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent
								className="w-60 p-0"
								align="start"
								onOpenAutoFocus={(e) => e.preventDefault()}
							>
								<div className="p-2">
									<Input
										placeholder="Filter event type…"
										value={searchEvent}
										onChange={(e) => setSearchEvent(e.target.value)}
										className="h-8 text-sm"
									/>
								</div>
								{suggestions.length > 0 && (
									<div className="border-t px-2 py-1.5 max-h-48 overflow-auto">
										{suggestions
											.filter((s) =>
												s.toLowerCase().includes(searchEvent.toLowerCase()),
											)
											.map((s) => (
												<button
													type="button"
													key={s}
													className="flex w-full items-center rounded-sm px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
													onClick={() => setSearchEvent(s)}
												>
													<Badge
														variant="outline"
														className="text-[10px] px-1 py-0 font-mono"
													>
														{s}
													</Badge>
												</button>
											))}
									</div>
								)}
							</PopoverContent>
						</Popover>
					</div>

					{/* Player filter */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Player
						</Label>
						<Input
							type="text"
							placeholder="Name or ID…"
							value={searchPlayer}
							onChange={(e) => setSearchPlayer(e.target.value)}
							className="h-9 w-48 bg-background"
						/>
					</div>

					{/* Date range */}
					<div className="flex flex-col gap-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Date Range
						</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									id="date"
									variant="outline"
									className="h-9 w-[260px] justify-start text-left font-normal bg-background"
								>
									<CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/80" />
									{dateRange?.from ? (
										dateRange.to ? (
											<>
												{format(dateRange.from, 'LLL dd, yyyy')} -{' '}
												{format(dateRange.to, 'LLL dd, yyyy')}
											</>
										) : (
											format(dateRange.from, 'LLL dd, yyyy')
										)
									) : (
										<span className="text-muted-foreground">
											Pick a date range
										</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="range"
									defaultMonth={dateRange?.from}
									selected={dateRange}
									onSelect={setDateRange}
									numberOfMonths={2}
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant={paused ? 'default' : 'outline'}
						size="sm"
						onClick={() => setPaused((p) => !p)}
						className="h-9 px-3 text-xs font-medium"
					>
						{paused ? 'Paused' : 'Live'}
					</Button>
					<Button
						onClick={() => {
							setSearchEvent('');
							setSearchPlayer('');
							setDateRange(undefined);
						}}
						className="h-9 px-3 text-xs font-medium"
						variant="outline"
					>
						Clear Filters
					</Button>
				</div>
			</div>

			<div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
				<span>
					{display.length.toLocaleString()} / {entries.length.toLocaleString()}{' '}
					events
				</span>
			</div>

			<ScrollArea className="flex-1 min-h-0 border rounded bg-card/50 p-2 pr-4">
				{loading ? (
					<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
						Loading event logs…
					</div>
				) : display.length > 0 ? (
					<div className="divide-y divide-border">
						{display.map((entry) => (
							<EventLogRow key={entry.id} entry={entry} />
						))}
					</div>
				) : entries.length > 0 ? (
					<div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-xl bg-muted/20">
						<Filter className="h-10 w-10 text-muted-foreground/40 mb-3" />
						<p className="text-sm font-semibold text-muted-foreground">
							No events match your filters
						</p>
						<p className="text-xs text-muted-foreground/60 mt-0.5">
							Try adjusting your search criteria.
						</p>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-xl bg-muted/20">
						<BadgeInfo className="h-10 w-10 text-muted-foreground/40 mb-3" />
						<p className="text-sm font-semibold text-muted-foreground">
							Waiting for events
						</p>
						<p className="text-xs text-muted-foreground/60 mt-0.5">
							Events will appear here as they occur in-game.
						</p>
					</div>
				)}
			</ScrollArea>
		</div>
	);
}
