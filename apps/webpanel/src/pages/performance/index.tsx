import { useEffect, useMemo, useState } from 'react';
import { ChartBar } from 'lucide-react';
import type { PerfThread, ServerSession } from '@fxmanager/shared/types';
import { PageHeader } from '@/components/page-header';
import { FullPerfChart } from './components/full-perf-chart';
import { PerfDistribution } from './components/perf-distribution';
import { DisconnectDonut } from './components/disconnect-donut';
import { PerfStatsGrid } from './components/process-stats';
import type { PerfInspect } from './components/perf-series';
import { usePerfSocket } from '@/hooks/ws-channels/use-perf';
import { usePerfSeries } from '@/hooks/ws-channels/use-perf-series';
import { useWsChannel } from '@/hooks/ws-channels/use-ws-core';

export default function PerformancePage() {
	const { samples } = usePerfSocket();

	// The performance chart is the single source of truth for session, thread and
	// zoom — the donut + distribution + stat cards all follow it.
	const [thread, setThread] = useState<PerfThread>('svMain');
	const { state: sessions } = useWsChannel<ServerSession[]>(
		'sessions',
		'update',
		[],
	);
	const [pickedId, setPickedId] = useState<number | null>(null);
	const [zoom, setZoom] = useState<{ start: number; end: number } | null>(null);
	const [inspect, setInspect] = useState<PerfInspect | null>(null);

	const defaultId = useMemo(() => {
		const live = sessions.find((s) => s.endedAt === null);
		return live?.id ?? sessions[0]?.id ?? null;
	}, [sessions]);

	const selectedId = pickedId ?? defaultId;
	const selected = sessions.find((s) => s.id === selectedId) ?? null;
	const isLive = selected?.endedAt === null;

	const { snapshots } = usePerfSeries(selectedId, isLive);

	// Drop a picked session that no longer exists (pruned after a restart).
	useEffect(() => {
		if (pickedId !== null && !sessions.some((s) => s.id === pickedId)) {
			setPickedId(null);
		}
	}, [sessions, pickedId]);

	// Clear zoom + inspection when the session changes — but NOT on live appends.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset on session swap only
	useEffect(() => {
		setZoom(null);
		setInspect(null);
	}, [selectedId]);

	// With an ended session selected and nothing hovered/zoomed, inspect the
	// whole session instead of silently falling back to the live feed.
	const effectiveInspect = useMemo<PerfInspect | null>(() => {
		if (inspect) return inspect;
		if (!selected || isLive || snapshots.length === 0) return null;
		return {
			kind: 'range',
			snapshots,
			start: selected.startedAt,
			end: selected.endedAt ?? snapshots[snapshots.length - 1].ts,
		};
	}, [inspect, selected, isLive, snapshots]);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto">
			<PageHeader
				Icon={ChartBar}
				title="Performance"
				description="Monitor fxServer thread distribution and system resource usage."
			/>

			<PerfStatsGrid samples={samples} inspect={effectiveInspect} />

			<div className="grid gap-6 lg:grid-cols-2">
				<DisconnectDonut
					sessionId={selectedId}
					session={selected}
					isLive={isLive}
					zoom={zoom}
				/>
				<PerfDistribution
					samples={samples}
					inspect={effectiveInspect}
					thread={thread}
				/>
			</div>

			<div className="flex min-h-[360px] flex-1 flex-col">
				<FullPerfChart
					thread={thread}
					onThreadChange={setThread}
					snapshots={snapshots}
					sessions={sessions}
					selectedId={selectedId}
					onSelect={setPickedId}
					zoom={zoom}
					onZoomChange={setZoom}
					onInspect={setInspect}
				/>
			</div>
		</div>
	);
}
