import { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { ANTICHEAT_CONVARS } from '@fxmanager/shared/constants';
import type {
	AnticheatConvarDef,
	AnticheatOverrides,
	ApiResponse,
} from '@fxmanager/shared/types';
import { QueryService } from '@/lib/query';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Spinner } from '@fxmanager/ui/components/spinner';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from '@fxmanager/ui/components/tooltip';

type SaveAnticheatResult = { overrides: AnticheatOverrides; warnings: string[] };

const UNSET = '__unset__';

function canon(overrides: AnticheatOverrides): string {
	return JSON.stringify(
		Object.entries(overrides).sort((a, b) => a[0].localeCompare(b[0])),
	);
}

function numberError(def: AnticheatConvarDef, value: string | undefined): string | null {
	if (def.control.kind !== 'number') return null;
	if (value === undefined || value.trim() === '') return null;
	const n = Number(value);
	if (!Number.isInteger(n)) return 'Whole number required';
	if (n < def.control.min) return `Min ${def.control.min}`;
	if (def.control.max !== undefined && n > def.control.max) {
		return `Max ${def.control.max}`;
	}
	return null;
}

export default function AnticheatSection() {
	const [overrides, setOverrides] = useState<AnticheatOverrides>({});
	const [baseline, setBaseline] = useState<AnticheatOverrides>({});
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		let active = true;
		void (async () => {
			try {
				const res = await QueryService<ApiResponse<AnticheatOverrides>>({
					endpoint: '/convars/anticheat',
					method: 'GET',
				});
				if (active && res.success) {
					setOverrides(res.data);
					setBaseline(res.data);
				}
			} catch {
				if (active) toast.error('Failed to load anticheat convars.');
			} finally {
				if (active) setLoading(false);
			}
		})();
		return () => {
			active = false;
		};
	}, []);

	function setValue(name: string, value: string | undefined) {
		setOverrides((prev) => {
			const next = { ...prev };
			if (value === undefined || value === '') delete next[name];
			else next[name] = value;
			return next;
		});
	}

	const isDirty = canon(overrides) !== canon(baseline);
	const allValid = ANTICHEAT_CONVARS.every(
		(def) => numberError(def, overrides[def.name]) === null,
	);
	const canSave = isDirty && allValid && !saving && !loading;

	function reset() {
		setOverrides(baseline);
	}

	async function save() {
		setSaving(true);
		try {
			const res = await QueryService<ApiResponse<SaveAnticheatResult>>({
				endpoint: '/convars/anticheat',
				method: 'POST',
				body: { overrides },
			});
			if (res.success) {
				setOverrides(res.data.overrides);
				setBaseline(res.data.overrides);
				for (const warning of res.data.warnings) toast.warning(warning);
				toast.success('Anticheat convars saved. Restart the server to apply.');
			} else {
				toast.error(res.error ?? 'Failed to save anticheat convars.');
			}
		} catch {
			toast.error('Failed to save anticheat convars.');
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

	function renderControl(def: AnticheatConvarDef) {
		const current = overrides[def.name];

		if (def.control.kind === 'number') {
			const error = numberError(def, current);
			return (
				<div className="space-y-1">
					<Input
						type="number"
						inputMode="numeric"
						min={def.control.min}
						max={def.control.max}
						value={current ?? ''}
						disabled={saving}
						aria-invalid={error !== null}
						placeholder={`Not set${def.control.unit ? ` (${def.control.unit})` : ''}`}
						onChange={(event) => setValue(def.name, event.currentTarget.value)}
					/>
					{error && <p className="text-xs text-destructive">{error}</p>}
				</div>
			);
		}

		const options =
			def.control.kind === 'boolean'
				? [
						{ value: 'true', label: 'Enabled' },
						{ value: 'false', label: 'Disabled' },
					]
				: def.control.options;

		return (
			<Select
				value={current ?? UNSET}
				disabled={saving}
				onValueChange={(value) =>
					setValue(def.name, value === UNSET ? undefined : value)
				}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value={UNSET}>Not set</SelectItem>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	return (
		<TooltipProvider>
			<div className="space-y-5">
				<div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
					<TriangleAlert className="mt-0.5 size-4 shrink-0" />
					<p>
						These convars are applied at startup only and take effect on the next
						server start or restart. Leave a convar as “Not set” to keep it out
						of the launch — your server.cfg is never overridden.
					</p>
				</div>

				<div className="divide-y rounded-lg border">
					{ANTICHEAT_CONVARS.map((def) => (
						<div
							key={def.name}
							className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div className="min-w-0 space-y-0.5">
								<div className="flex items-center gap-1.5">
									<span className="text-sm font-medium">{def.label}</span>
									<Tooltip>
										<TooltipTrigger asChild>
											<button
												type="button"
												aria-label={`About ${def.name}`}
												className="flex size-4 items-center justify-center rounded-full border text-[10px] leading-none text-muted-foreground hover:text-foreground"
											>
												?
											</button>
										</TooltipTrigger>
										<TooltipContent className="max-w-sm space-y-1">
											<p>{def.description}</p>
											{def.note && (
												<p className="text-amber-300">Note: {def.note}</p>
											)}
											<p className="opacity-70">
												Recommended: {def.recommended}
											</p>
										</TooltipContent>
									</Tooltip>
								</div>
								<span className="block font-mono text-xs text-muted-foreground">
									{def.setter} {def.name}
								</span>
							</div>

							<div className="w-full sm:w-52">{renderControl(def)}</div>
						</div>
					))}
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
		</TooltipProvider>
	);
}
