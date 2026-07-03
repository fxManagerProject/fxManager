import {
	PERF_THREADS,
	type PerfSnapshot,
	type PerfThread,
	type ServerSession,
} from '@fxmanager/shared/types';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import { format } from 'date-fns';
import { LineChart, X } from 'lucide-react';
import { PerfHeatmap } from './perf-heatmap';
import type { PerfInspect } from './perf-series';

function sessionLabel(s: ServerSession) {
	const start = format(new Date(s.startedAt), 'HH:mm');
	if (s.endedAt === null) return `Live — since ${start}`;
	const end = format(new Date(s.endedAt), 'HH:mm');
	const day = format(new Date(s.startedAt), 'MMM d');
	return `Restart (${start} – ${end}) · ${day}`;
}

/** The shared, controlled chart — its session/thread/zoom drive the whole page. */
export function FullPerfChart({
	thread,
	onThreadChange,
	snapshots,
	sessions,
	selectedId,
	onSelect,
	zoom,
	onZoomChange,
	onInspect,
}: {
	thread: PerfThread;
	onThreadChange: (t: PerfThread) => void;
	snapshots: PerfSnapshot[];
	sessions: ServerSession[];
	selectedId: number | null;
	onSelect: (id: number) => void;
	zoom: { start: number; end: number } | null;
	onZoomChange: (zoom: { start: number; end: number } | null) => void;
	onInspect?: (inspect: PerfInspect | null) => void;
}) {
	const hasData = snapshots.length >= 2;

	return (
		<Card className="flex h-full flex-col gap-2 py-3">
			<CardHeader className="flex flex-col gap-3 space-y-0 px-4 sm:flex-row sm:items-start sm:justify-between">
				<div className="space-y-1.5">
					<CardTitle className="flex items-center gap-2">
						<LineChart className="h-4 w-4" />
						Performance over time
					</CardTitle>
					<CardDescription>
						{thread} tick-time buckets (right) &amp; player count (left)
					</CardDescription>
				</div>
				<div className="flex flex-wrap items-center gap-2">
					<div className="inline-flex rounded-md border p-0.5">
						{PERF_THREADS.map((t) => (
							<button
								key={t}
								type="button"
								aria-pressed={thread === t}
								onClick={() => onThreadChange(t)}
								className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
									thread === t
										? 'bg-primary text-primary-foreground'
										: 'text-muted-foreground hover:text-foreground'
								}`}
							>
								{t}
							</button>
						))}
					</div>
					{zoom && (
						<button
							type="button"
							onClick={() => onZoomChange(null)}
							title="Clear zoom"
							className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-xs font-medium tabular-nums text-foreground hover:bg-primary/20"
						>
							{format(new Date(zoom.start), 'HH:mm')} –{' '}
							{format(new Date(zoom.end), 'HH:mm')}
							<X className="h-3 w-3" />
						</button>
					)}
					<Select
						value={selectedId != null ? String(selectedId) : ''}
						onValueChange={(v) => onSelect(Number(v))}
					>
						<SelectTrigger className="w-[230px]">
							<SelectValue placeholder="No sessions yet" />
						</SelectTrigger>
						<SelectContent>
							{sessions.map((s) => (
								<SelectItem key={s.id} value={String(s.id)}>
									{sessionLabel(s)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</CardHeader>
			<CardContent className="min-h-0 flex-1 px-3 pb-2">
				{!hasData ? (
					<div className="flex h-full min-h-[300px] items-center justify-center text-center text-sm text-muted-foreground">
						Collecting performance data… (samples appear ~30s after the server
						starts)
					</div>
				) : (
					<PerfHeatmap
						snapshots={snapshots}
						thread={thread}
						zoom={zoom}
						onZoomChange={onZoomChange}
						onInspect={onInspect}
					/>
				)}
			</CardContent>
		</Card>
	);
}
