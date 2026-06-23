import { repo, type ImportSummary } from '@fxmanager/database';

// re-exec contract: the server re-runs its own binary with this flag to import
// a txAdmin DB in a child process, keeping the blocking sync import off the
// main event loop. stdout is shared with startup logs, so the result is framed
// with a marker the parent slices out.
export const MIGRATE_WORKER_FLAG = '--fxm-migrate-worker';
const RESULT_MARKER = '__FXM_MIGRATE_RESULT__';

type WorkerResult =
	| { ok: true; summary: ImportSummary }
	| { ok: false; error: string };

/**
 * Child entry: read the raw txAdmin JSON from stdin, import it, and write a
 * marked result to stdout. Always exits; never returns to normal startup.
 */
export async function runMigrateWorker(): Promise<never> {
	let result: WorkerResult;

	try {
		const raw = await Bun.stdin.text();

		let json: unknown;
		try {
			json = JSON.parse(raw);
		} catch {
			throw new Error('invalid_txadmin_db');
		}

		result = { ok: true, summary: repo.migrate.fromTxAdmin(json) };
	} catch (err) {
		result = { ok: false, error: (err as Error).message };
	}

	await Bun.write(Bun.stdout, `\n${RESULT_MARKER}${JSON.stringify(result)}\n`);
	process.exit(0);
}

/**
 * Parent side: import a raw txAdmin payload by re-running this binary in worker
 * mode. Rejects with `invalid_txadmin_db` for unrecognisable payloads.
 */
export async function runMigrateInChildProcess(
	raw: string,
): Promise<ImportSummary> {
	const proc = Bun.spawn([process.execPath, Bun.main, MIGRATE_WORKER_FLAG], {
		stdin: 'pipe',
		stdout: 'pipe',
		stderr: 'inherit',
	});

	proc.stdin.write(raw);
	await proc.stdin.end();

	const out = await new Response(proc.stdout).text();
	await proc.exited;

	const marker = out.lastIndexOf(RESULT_MARKER);
	if (marker === -1) throw new Error('migrate_worker_failed');

	const result = JSON.parse(
		out.slice(marker + RESULT_MARKER.length).trim(),
	) as WorkerResult;

	if (!result.ok) throw new Error(result.error);
	return result.summary;
}
