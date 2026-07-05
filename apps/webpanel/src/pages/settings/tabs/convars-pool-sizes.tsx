import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCcw, TriangleAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import type {
	ApiResponse,
	ConvarGameType,
	ConvarPoolConfig,
	PoolSizeLimits,
} from '@fxmanager/shared/types';
import { QueryService } from '@/lib/query';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Label } from '@fxmanager/ui/components/label';
import { Spinner } from '@fxmanager/ui/components/spinner';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';

type Row = { pool: string; value: string };
type Baseline = { gameType: ConvarGameType; rows: Row[] };
type SavePoolSizesResult = ConvarPoolConfig & { warnings: string[] };

const GAME_LABELS: Record<ConvarGameType, string> = {
	fivem: 'FiveM',
	redm: 'RedM',
};

function toRows(poolSizes: Record<string, number>): Row[] {
	return Object.entries(poolSizes).map(([pool, value]) => ({
		pool,
		value: String(value),
	}));
}

function serialize(gameType: ConvarGameType, rows: Row[]): string {
	return JSON.stringify({
		gameType,
		rows: [...rows]
			.map((row) => [row.pool, row.value.trim()])
			.sort((a, b) => a[0].localeCompare(b[0])),
	});
}

export default function PoolSizesSection() {
	const [gameType, setGameType] = useState<ConvarGameType>('fivem');
	const [rows, setRows] = useState<Row[]>([]);
	const [baseline, setBaseline] = useState<Baseline>({
		gameType: 'fivem',
		rows: [],
	});
	const [limits, setLimits] = useState<PoolSizeLimits | null>(null);

	const [loading, setLoading] = useState(true);
	const [limitsLoading, setLimitsLoading] = useState(false);
	const [limitsError, setLimitsError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	const loadLimits = useCallback(async (game: ConvarGameType) => {
		setLimitsLoading(true);
		setLimitsError(null);
		try {
			const res = await QueryService<ApiResponse<PoolSizeLimits>>({
				endpoint: `/convars/pool-limits?game=${game}`,
				method: 'GET',
			});
			if (res.success) setLimits(res.data);
			else setLimitsError(res.error ?? 'Failed to load pool limits.');
		} catch {
			setLimitsError('Failed to load the pool list from cfx.re.');
		} finally {
			setLimitsLoading(false);
		}
	}, []);

	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				const res = await QueryService<ApiResponse<ConvarPoolConfig>>({
					endpoint: '/convars/pool-sizes',
					method: 'GET',
				});
				if (active && res.success) {
					const loaded = toRows(res.data.poolSizes);
					setGameType(res.data.gameType);
					setRows(loaded);
					setBaseline({ gameType: res.data.gameType, rows: loaded });
				}
			} catch {
				if (active) toast.error('Failed to load pool sizes.');
			} finally {
				if (active) setLoading(false);
			}
		})();
		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (loading) return;
		void loadLimits(gameType);
	}, [gameType, loading, loadLimits]);

	const usedPools = useMemo(() => new Set(rows.map((row) => row.pool)), [rows]);
	const availablePools = useMemo(
		() =>
			Object.keys(limits ?? {})
				.filter((pool) => !usedPools.has(pool))
				.sort((a, b) => a.localeCompare(b)),
		[limits, usedPools],
	);

	function addPool(pool: string) {
		setRows((prev) => [...prev, { pool, value: '' }]);
	}

	function removePool(pool: string) {
		setRows((prev) => prev.filter((row) => row.pool !== pool));
	}

	function updateValue(pool: string, value: string) {
		setRows((prev) =>
			prev.map((row) => (row.pool === pool ? { ...row, value } : row)),
		);
	}

	function clampValue(pool: string) {
		const max = limits?.[pool];
		setRows((prev) =>
			prev.map((row) => {
				if (row.pool !== pool) return row;
				const trimmed = row.value.trim();
				if (trimmed === '') return { ...row, value: '' };
				let n = Math.floor(Number(trimmed));
				if (Number.isNaN(n)) return { ...row, value: '' };
				if (n < 1) n = 1;
				if (max !== undefined && n > max) n = max;
				return { ...row, value: String(n) };
			}),
		);
	}

	function rowError(row: Row): string | null {
		const max = limits?.[row.pool];
		if (limits && max === undefined) {
			return `Not available for ${GAME_LABELS[gameType]}`;
		}
		const trimmed = row.value.trim();
		if (trimmed === '') return 'Enter a value';
		const n = Number(trimmed);
		if (!Number.isInteger(n) || n < 1) return 'Positive integer required';
		if (max !== undefined && n > max) return `Max ${max}`;
		return null;
	}

	const isDirty =
		serialize(gameType, rows) !== serialize(baseline.gameType, baseline.rows);
	const allValid = limits !== null && rows.every((row) => rowError(row) === null);
	const canSave = isDirty && allValid && !saving && !loading;

	function reset() {
		setGameType(baseline.gameType);
		setRows(baseline.rows);
	}

	async function save() {
		const poolSizes: Record<string, number> = {};
		for (const row of rows) poolSizes[row.pool] = Number(row.value.trim());

		setSaving(true);
		try {
			const res = await QueryService<ApiResponse<SavePoolSizesResult>>({
				endpoint: '/convars/pool-sizes',
				method: 'POST',
				body: { gameType, poolSizes },
			});

			if (res.success) {
				const saved = toRows(res.data.poolSizes);
				setGameType(res.data.gameType);
				setRows(saved);
				setBaseline({ gameType: res.data.gameType, rows: saved });
				for (const warning of res.data.warnings) toast.warning(warning);
				toast.success('Pool sizes saved. Restart the server to apply.');
			} else {
				toast.error(res.error ?? 'Failed to save pool sizes.');
			}
		} catch {
			toast.error('Failed to save pool sizes.');
		} finally {
			setSaving(false);
		}
	}

	if (loading) {
		return (
			<div className="flex items-center justify-center py-12">
				<Spinner className="size-8" />
			</div>
		);
	}

	return (
		<div className="space-y-5">
			<div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
				<TriangleAlert className="mt-0.5 size-4 shrink-0" />
				<p>
					Pool sizes are applied at startup only. Changes take effect the next
					time the server starts or restarts.
				</p>
			</div>

			<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div className="space-y-0.5">
					<Label>Game</Label>
					<p className="text-sm text-muted-foreground">
						Determines which pools and limits apply.
					</p>
				</div>
				<div className="sm:w-48">
					<Select
						value={gameType}
						onValueChange={(value) => setGameType(value as ConvarGameType)}
						disabled={saving}
					>
						<SelectTrigger className="w-full">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="fivem">FiveM</SelectItem>
							<SelectItem value="redm">RedM</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-3">
				<div className="flex items-center justify-between">
					<Label>Pool overrides</Label>
					{limitsLoading && <Spinner className="size-4" />}
				</div>

				{limitsError && (
					<div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
						<span>{limitsError}</span>
						<Button
							type="button"
							size="sm"
							variant="secondary"
							onClick={() => loadLimits(gameType)}
						>
							<RefreshCcw /> Retry
						</Button>
					</div>
				)}

				{rows.length === 0 ? (
					<p className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
						No pool overrides. Nothing is injected until you add one.
					</p>
				) : (
					<div className="space-y-2">
						{rows.map((row) => {
							const error = rowError(row);
							const max = limits?.[row.pool];
							return (
								<div key={row.pool} className="flex items-center gap-3">
									<span className="w-56 truncate font-mono text-sm" title={row.pool}>
										{row.pool}
									</span>
									<Input
										type="number"
										inputMode="numeric"
										min={1}
										max={max}
										className="w-32"
										value={row.value}
										disabled={saving}
										aria-invalid={error !== null}
										placeholder={max !== undefined ? `1–${max}` : '—'}
										onChange={(event) =>
											updateValue(row.pool, event.currentTarget.value)
										}
										onBlur={() => clampValue(row.pool)}
									/>
									<span className="w-28 text-sm text-muted-foreground">
										{max !== undefined ? `max ${max}` : ''}
									</span>
									<span className="flex-1 text-sm text-destructive">
										{error && error !== 'Enter a value' ? error : ''}
									</span>
									<Button
										type="button"
										size="icon"
										variant="ghost"
										disabled={saving}
										aria-label={`Remove ${row.pool}`}
										onClick={() => removePool(row.pool)}
									>
										<X />
									</Button>
								</div>
							);
						})}
					</div>
				)}

				<Select
					key={rows.length}
					onValueChange={addPool}
					disabled={saving || limitsLoading || availablePools.length === 0}
				>
					<SelectTrigger className="w-64">
						<Plus className="size-4" />
						<SelectValue
							placeholder={
								availablePools.length === 0 ? 'All pools added' : 'Add pool…'
							}
						/>
					</SelectTrigger>
					<SelectContent>
						{availablePools.map((pool) => (
							<SelectItem key={pool} value={pool}>
								{pool}
								<span className="ml-2 text-muted-foreground">
									max {limits?.[pool]}
								</span>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div className="flex gap-2">
				<Button type="button" disabled={!canSave} onClick={save}>
					{saving && <Spinner className="size-4" />}
					Save changes
				</Button>
				<Button
					type="button"
					variant="ghost"
					disabled={!isDirty || saving}
					onClick={reset}
				>
					Reset
				</Button>
			</div>
		</div>
	);
}
