import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PerfSnapshot, PerfThread } from '@fxmanager/shared/types';
import { format } from 'date-fns';
import { BANDS, bandColor, bandLabel } from './perf-buckets';
import { bandFractions, snapshotIdxAt, type PerfInspect } from './perf-series';

const MARGIN = { top: 8, right: 50, bottom: 22, left: 36 };
const AXIS = '#a1a1aa';
const PLAYER_LINE = '#f4f4f5';
const MIN_DRAG_PX = 6;

const HEAT: Array<[number, [number, number, number]]> = [
	[0.0, [24, 20, 37]],
	[0.15, [59, 15, 112]],
	[0.4, [140, 41, 129]],
	[0.65, [222, 73, 104]],
	[0.85, [254, 159, 109]],
	[1.0, [252, 253, 191]],
];

function heatColor(t: number): string {
	const x = Math.max(0, Math.min(1, Math.sqrt(t)));
	for (let i = 1; i < HEAT.length; i++) {
		const stop = HEAT[i];
		if (x <= stop[0]) {
			const prev = HEAT[i - 1];
			const f = (x - prev[0]) / (stop[0] - prev[0] || 1);
			const r = Math.round(prev[1][0] + (stop[1][0] - prev[1][0]) * f);
			const g = Math.round(prev[1][1] + (stop[1][1] - prev[1][1]) * f);
			const b = Math.round(prev[1][2] + (stop[1][2] - prev[1][2]) * f);
			return `rgb(${r},${g},${b})`;
		}
	}
	return 'rgb(252,253,191)';
}

const clamp = (v: number, lo: number, hi: number) =>
	v < lo ? lo : v > hi ? hi : v;

interface Hover {
	idx: number;
	x: number;
	y: number;
}

/** Scale a canvas for the device pixel ratio and return its 2d context. */
function prepare2d(canvas: HTMLCanvasElement, w: number, h: number) {
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	const dpr = window.devicePixelRatio || 1;
	canvas.width = Math.round(w * dpr);
	canvas.height = Math.round(h * dpr);
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.clearRect(0, 0, w, h);
	return ctx;
}

export function PerfHeatmap({
	snapshots,
	thread,
	zoom,
	onZoomChange,
	onInspect,
}: {
	snapshots: PerfSnapshot[];
	thread: PerfThread;
	zoom: { start: number; end: number } | null;
	onZoomChange: (zoom: { start: number; end: number } | null) => void;
	onInspect?: (inspect: PerfInspect | null) => void;
}) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const overlayRef = useRef<HTMLCanvasElement | null>(null);
	const onInspectRef = useRef(onInspect);
	onInspectRef.current = onInspect;

	const [size, setSize] = useState({ w: 0, h: 0 });
	const [hover, setHover] = useState<Hover | null>(null);
	const [drag, setDrag] = useState<{ x0: number; x1: number } | null>(null);

	const model = useMemo(() => {
		const fractions = snapshots.map((s) => bandFractions(s, thread));
		const players = snapshots.map((s) => s.players);
		const peak = players.reduce((m, p) => Math.max(m, p), 0);
		const playersMax = Math.max(5, Math.ceil((peak + 1) / 5) * 5);
		return { fractions, players, playersMax };
	}, [snapshots, thread]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	const view = useMemo(() => {
		const n = snapshots.length;
		const fullMin = snapshots[0]?.ts ?? 0;
		const fullMax = snapshots[n - 1]?.ts ?? 1;
		const min = zoom ? zoom.start : fullMin;
		const max = zoom ? zoom.end : fullMax;
		return { min, max };
	}, [snapshots, zoom]);

	// Report what to inspect: the hovered point, else the zoomed range, else
	// live. Keyed on the hovered index so parents don't re-render per pixel.
	const hoverIdx = hover?.idx ?? null;
	useEffect(() => {
		const cb = onInspectRef.current;
		if (!cb) return;
		if (hoverIdx !== null && hoverIdx < snapshots.length) {
			cb({ kind: 'point', snapshot: snapshots[hoverIdx] });
		} else if (zoom) {
			const inRange = snapshots.filter(
				(s) => s.ts >= zoom.start && s.ts <= zoom.end,
			);
			cb({
				kind: 'range',
				snapshots: inRange,
				start: zoom.start,
				end: zoom.end,
			});
		} else {
			cb(null);
		}
	}, [hoverIdx, zoom, snapshots]);

	// base layer: heatmap cells + player line + axes (no hover/drag deps)
	useEffect(() => {
		const canvas = canvasRef.current;
		const { w, h } = size;
		if (!canvas || w <= 0 || h <= 0) return;
		const ctx = prepare2d(canvas, w, h);
		if (!ctx) return;

		const x0 = MARGIN.left;
		const y0 = MARGIN.top;
		const plotW = w - MARGIN.left - MARGIN.right;
		const plotH = h - MARGIN.top - MARGIN.bottom;
		const n = snapshots.length;
		if (plotW <= 0 || plotH <= 0 || n === 0) return;

		const span = view.max - view.min || 1;
		const xOf = (ts: number) => x0 + ((ts - view.min) / span) * plotW;
		const bandH = plotH / BANDS;
		const yTop = (b: number) => y0 + (BANDS - 1 - b) * bandH;

		ctx.fillStyle = 'rgb(24,20,37)';
		ctx.fillRect(x0, y0, plotW, plotH);

		// clip cells + line to the plot area (so zoom crops cleanly)
		ctx.save();
		ctx.beginPath();
		ctx.rect(x0, y0, plotW, plotH);
		ctx.clip();

		for (let i = 0; i < n; i++) {
			const ts = snapshots[i].ts;
			// a cell spans [ts, next ts) — skip it only when that interval
			// misses the view window entirely
			const nextTs = i < n - 1 ? snapshots[i + 1].ts : Infinity;
			if (nextTs < view.min || ts > view.max) continue;
			const cx = xOf(ts);
			const nx = i < n - 1 ? xOf(nextTs) : x0 + plotW;
			const cw = Math.max(1, nx - cx);
			const fr = model.fractions[i];
			for (let b = 0; b < BANDS; b++) {
				const f = fr[b] ?? 0;
				if (f <= 0) continue;
				ctx.fillStyle = heatColor(f);
				ctx.fillRect(cx, yTop(b), cw + 0.75, bandH + 0.75);
			}
		}

		// player-count line
		const pMax = model.playersMax;
		const yOfP = (p: number) => y0 + plotH - (p / pMax) * plotH;
		ctx.beginPath();
		let started = false;
		for (let i = 0; i < n; i++) {
			const cx = xOf(snapshots[i].ts);
			const nx = i < n - 1 ? xOf(snapshots[i + 1].ts) : x0 + plotW;
			const mid = (cx + nx) / 2;
			const y = yOfP(model.players[i]);
			if (!started) {
				ctx.moveTo(mid, y);
				started = true;
			} else ctx.lineTo(mid, y);
		}
		ctx.strokeStyle = PLAYER_LINE;
		ctx.lineWidth = 1.75;
		ctx.stroke();

		ctx.restore();

		// axes
		ctx.font = '10px ui-sans-serif, system-ui, sans-serif';
		ctx.fillStyle = AXIS;

		ctx.textBaseline = 'middle';
		ctx.textAlign = 'left';
		for (let b = 0; b < BANDS; b++) {
			ctx.fillText(bandLabel(b), x0 + plotW + 5, yTop(b) + bandH / 2);
		}

		ctx.textAlign = 'right';
		const step = pMax <= 10 ? 1 : pMax / 5;
		for (let p = 0; p <= pMax + 0.01; p += step) {
			ctx.fillText(String(Math.round(p)), x0 - 5, yOfP(p));
		}

		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';
		const ticks = Math.max(2, Math.min(8, Math.floor(plotW / 90)));
		for (let k = 0; k <= ticks; k++) {
			const ts = view.min + (span * k) / ticks;
			ctx.fillText(format(new Date(ts), 'HH:mm'), xOf(ts), y0 + plotH + 5);
		}
	}, [size, snapshots, model, view]);

	// overlay layer: drag selection + hover highlight, clipped to the plot
	useEffect(() => {
		const canvas = overlayRef.current;
		const { w, h } = size;
		if (!canvas || w <= 0 || h <= 0) return;
		const ctx = prepare2d(canvas, w, h);
		if (!ctx) return;

		const x0 = MARGIN.left;
		const y0 = MARGIN.top;
		const plotW = w - MARGIN.left - MARGIN.right;
		const plotH = h - MARGIN.top - MARGIN.bottom;
		const n = snapshots.length;
		if (plotW <= 0 || plotH <= 0 || n === 0) return;

		const span = view.max - view.min || 1;
		const xOf = (ts: number) => x0 + ((ts - view.min) / span) * plotW;

		ctx.save();
		ctx.beginPath();
		ctx.rect(x0, y0, plotW, plotH);
		ctx.clip();

		if (drag) {
			const a = clamp(Math.min(drag.x0, drag.x1), x0, x0 + plotW);
			const b = clamp(Math.max(drag.x0, drag.x1), x0, x0 + plotW);
			ctx.fillStyle = 'rgba(147,197,253,0.18)';
			ctx.fillRect(a, y0, b - a, plotH);
			ctx.strokeStyle = 'rgba(147,197,253,0.7)';
			ctx.lineWidth = 1;
			ctx.strokeRect(a + 0.5, y0 + 0.5, b - a, plotH);
		} else if (hoverIdx !== null && hoverIdx < n) {
			const cx = xOf(snapshots[hoverIdx].ts);
			const nx =
				hoverIdx < n - 1 ? xOf(snapshots[hoverIdx + 1].ts) : x0 + plotW;
			ctx.strokeStyle = 'rgba(255,255,255,0.7)';
			ctx.lineWidth = 1;
			ctx.strokeRect(cx + 0.5, y0 + 0.5, Math.max(1, nx - cx), plotH);
		}

		ctx.restore();
	}, [size, snapshots, view, hoverIdx, drag]);

	const cellAt = useCallback(
		(mx: number, rectW: number) => {
			const x0 = MARGIN.left;
			const plotW = rectW - MARGIN.left - MARGIN.right;
			const span = view.max - view.min || 1;
			const ts = view.min + ((clamp(mx, x0, x0 + plotW) - x0) / plotW) * span;
			return snapshotIdxAt(snapshots, ts, view.min, view.max);
		},
		[snapshots, view],
	);

	const onDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
		const el = containerRef.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const mx = e.clientX - rect.left;
		setDrag({ x0: mx, x1: mx });
		setHover(null);
	}, []);

	const onMove = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			const el = containerRef.current;
			const n = snapshots.length;
			if (!el || n === 0) return;
			const rect = el.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const my = e.clientY - rect.top;

			if (drag) {
				setDrag((d) => (d ? { ...d, x1: mx } : d));
				return;
			}

			const x0 = MARGIN.left;
			const plotW = rect.width - MARGIN.left - MARGIN.right;
			if (mx < x0 || mx > x0 + plotW) {
				setHover(null);
				return;
			}
			const idx = cellAt(mx, rect.width);
			setHover(idx === -1 ? null : { idx, x: mx, y: my });
		},
		[snapshots, drag, cellAt],
	);

	const onUp = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (!drag) return;
			const el = containerRef.current;
			if (!el) {
				setDrag(null);
				return;
			}
			const rect = el.getBoundingClientRect();
			const mx = e.clientX - rect.left;
			const x0 = MARGIN.left;
			const plotW = rect.width - MARGIN.left - MARGIN.right;
			const span = view.max - view.min || 1;
			const tOf = (px: number) =>
				view.min + ((clamp(px, x0, x0 + plotW) - x0) / plotW) * span;
			if (Math.abs(mx - drag.x0) >= MIN_DRAG_PX) {
				const a = tOf(drag.x0);
				const b = tOf(mx);
				onZoomChange({ start: Math.min(a, b), end: Math.max(a, b) });
			}
			setDrag(null);
		},
		[drag, view, onZoomChange],
	);

	const onLeave = useCallback(() => {
		setHover(null);
		setDrag(null);
	}, []);

	const tip =
		hover && !drag && hover.idx < snapshots.length
			? {
					s: snapshots[hover.idx],
					players: model.players[hover.idx],
					rows: model.fractions[hover.idx]
						.map((f, b) => ({ b, f }))
						.filter((r) => r.f >= 0.005)
						.sort((a, b) => b.f - a.f)
						.slice(0, 5),
				}
			: null;

	return (
		<div
			ref={containerRef}
			className="relative h-full w-full cursor-crosshair select-none"
			onMouseDown={onDown}
			onMouseMove={onMove}
			onMouseUp={onUp}
			onMouseLeave={onLeave}
			onDoubleClick={() => onZoomChange(null)}
		>
			<canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
			<canvas
				ref={overlayRef}
				className="pointer-events-none absolute inset-0"
				style={{ width: '100%', height: '100%' }}
			/>
			{tip && hover && (
				<div
					className="pointer-events-none absolute z-50 min-w-[9rem] space-y-1 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
					style={{
						left: hover.x,
						top: hover.y,
						transform: `translate(${
							hover.x > size.w * 0.6 ? 'calc(-100% - 12px)' : '12px'
						}, -50%)`,
					}}
				>
					<div className="font-medium">
						{format(new Date(tip.s.ts), 'MMM d HH:mm')}
					</div>
					<div className="text-muted-foreground">Players: {tip.players}</div>
					{tip.rows.map((r) => (
						<div key={r.b} className="flex items-center gap-1.5">
							<span
								className="inline-block size-2 shrink-0 rounded-sm"
								style={{ backgroundColor: bandColor(r.b) }}
							/>
							<span className="tabular-nums">
								{bandLabel(r.b)}: {(r.f * 100).toFixed(1)}%
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
