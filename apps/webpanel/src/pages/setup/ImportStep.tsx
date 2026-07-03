import { useRef, useState } from 'react';
import { CheckCircle2, InfoIcon, UploadCloud } from 'lucide-react';
import { cn } from '@fxmanager/ui/lib/utils';
import { Button } from '@fxmanager/ui/components/button';
import { Alert, AlertDescription } from '@fxmanager/ui/components/alert';
import { Spinner } from '@fxmanager/ui/components/spinner';
import type { ImportSummary } from '@fxmanager/database/types';

interface ImportStepProps {
	onFinish: () => void;
}

async function uploadTxAdminDb(rawJson: string): Promise<ImportSummary> {
	const res = await fetch('/api/migrate', {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/octet-stream' },
		body: rawJson,
	});

	const payload = (await res.json().catch(() => null)) as
		| { success: true; data: ImportSummary }
		| { success: false; error: string }
		| null;

	if (!res.ok || !payload?.success) {
		throw new Error(
			(payload && !payload.success && payload.error) ||
				'Import failed. Please try again.',
		);
	}

	return payload.data;
}

function summaryRows(
	summary: ImportSummary,
): { label: string; value: string }[] {
	return [
		{
			label: 'Players',
			value: `${summary.players.created} new, ${summary.players.matched} matched`,
		},
		{ label: 'Identifiers', value: `${summary.identifiers.created} new` },
		{ label: 'Notes', value: `${summary.notes.created} new` },
		{
			label: 'Bans',
			value: `${summary.bans.created} new, ${summary.bans.skipped} skipped`,
		},
		{
			label: 'Warns',
			value: `${summary.warns.created} new, ${summary.warns.skipped} skipped`,
		},
		{ label: 'Whitelist', value: `${summary.whitelist.created} new` },
		{ label: 'Stub players', value: `${summary.stubPlayers}` },
	];
}

export function ImportStep({ onFinish }: ImportStepProps) {
	const [summary, setSummary] = useState<ImportSummary | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [fileName, setFileName] = useState<string | null>(null);
	const [dragging, setDragging] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	async function handleFile(file: File | null | undefined) {
		if (!file || loading) return;

		setError(null);
		setSummary(null);
		setFileName(file.name);
		setLoading(true);
		try {
			const text = await file.text();
			setSummary(await uploadTxAdminDb(text));
		} catch (err) {
			setError((err as Error).message);
		} finally {
			setLoading(false);
		}
	}

	function handleDrop(e: React.DragEvent<HTMLButtonElement>) {
		e.preventDefault();
		setDragging(false);
		handleFile(e.dataTransfer.files?.[0]);
	}

	return (
		<div className="max-w-md mx-auto w-full py-8 flex flex-col gap-4">
			<div className="space-y-1">
				<h3 className="text-base font-semibold">Import from txAdmin</h3>
				<p className="text-xs text-muted-foreground">
					Optional — bring your existing data across before you start.
				</p>
			</div>

			<Alert>
				<InfoIcon className="size-4" />
				<AlertDescription>
					Upload your txAdmin{' '}
					<span className="font-medium text-foreground">playersDB.json</span> to
					import players, bans, warns and the whitelist.
				</AlertDescription>
			</Alert>

			<input
				ref={inputRef}
				type="file"
				accept=".json,application/json"
				className="hidden"
				onChange={(e) => handleFile(e.target.files?.[0])}
			/>

			<button
				type="button"
				disabled={loading}
				onClick={() => inputRef.current?.click()}
				onDragOver={(e) => {
					e.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={handleDrop}
				className={cn(
					'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition-colors',
					'hover:border-primary/60 hover:bg-accent/40',
					dragging && 'border-primary bg-accent/60',
					loading && 'pointer-events-none opacity-60',
				)}
			>
				{loading ? (
					<Spinner className="size-6 text-muted-foreground" />
				) : (
					<UploadCloud className="size-6 text-muted-foreground" />
				)}
				<span className="text-sm font-medium">
					{loading
						? 'Importing...'
						: (fileName ?? 'Drop playersDB.json here or click to browse')}
				</span>
			</button>

			{summary && (
				<div className="flex flex-col gap-3">
					<Alert>
						<CheckCircle2 className="size-4 text-primary" />
						<AlertDescription>Import complete.</AlertDescription>
					</Alert>
					<dl className="flex flex-col gap-1 text-sm">
						{summaryRows(summary).map((row) => (
							<div
								key={row.label}
								className="flex items-center justify-between gap-2"
							>
								<dt className="text-muted-foreground">{row.label}</dt>
								<dd className="font-medium">{row.value}</dd>
							</div>
						))}
					</dl>
				</div>
			)}

			{error && <p className="text-sm text-destructive text-center">{error}</p>}

			<Button className="w-full mt-2" disabled={loading} onClick={onFinish}>
				{summary ? 'Finish & go to dashboard' : 'Skip & go to dashboard'}
			</Button>
		</div>
	);
}
