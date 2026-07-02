import { repo } from '@fxmanager/database';
import {
	PERF_WINDOW_MS,
	type PerfSnapshot,
	type RawPerf,
} from '@fxmanager/shared/types';
import { diffPerfs, didPerfReset, parseRawPerf } from './parser';
import { wsManager } from '../ws/manager';
import { sessionManager } from '../session/manager';
import { getServerNetEndpoint } from '../../common/fxserver-endpoint';

const SAMPLE_INTERVAL_MS = 30_000;

class PerfManager {
	private interval: ReturnType<typeof setInterval> | null = null;
	private lastRaw: RawPerf | null = null;
	private recent: PerfSnapshot[] = [];

	/** Poll `/perf/` continuously, regardless of who started the fxserver. */
	start(): void {
		if (this.interval) return;
		void this.tick();
		this.interval = setInterval(() => void this.tick(), SAMPLE_INTERVAL_MS);
	}

	stop(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
		this.lastRaw = null;
		this.recent = [];
	}

	/** The last 30 min of samples, used to backfill freshly connected clients. */
	getRecent(): PerfSnapshot[] {
		return this.recent;
	}

	private async fetchRawPerfData(): Promise<RawPerf | null> {
		try {
			const endpoint = await getServerNetEndpoint();
			const res = await fetch(`http://${endpoint}/perf/`, {
				signal: AbortSignal.timeout(SAMPLE_INTERVAL_MS / 2),
			});
			if (!res.ok) return null;
			return parseRawPerf(await res.text());
		} catch {
			return null;
		}
	}

	private async tick(): Promise<void> {
		const raw = await this.fetchRawPerfData();

		if (!raw || Object.keys(raw).length === 0) {
			this.lastRaw = null;
			return;
		}

		if (!this.lastRaw || didPerfReset(raw, this.lastRaw)) {
			this.lastRaw = raw;
			return;
		}

		const players = sessionManager.getPlayerCount();
		const snapshot: PerfSnapshot = {
			ts: Date.now(),
			players,
			threads: diffPerfs(raw, this.lastRaw),
		};
		this.lastRaw = raw;

		const sessionId = sessionManager.getCurrentId();
		if (sessionId !== null) {
			try {
				repo.perfSnapshots.insert({
					sessionId,
					ts: snapshot.ts,
					players,
					perf: snapshot.threads,
				});
			} catch (err) {
				console.error(
					'[perf] failed to persist snapshot:',
					(err as Error).message,
				);
			}
		}

		const cutoff = Date.now() - PERF_WINDOW_MS;
		this.recent = [...this.recent, snapshot].filter((s) => s.ts >= cutoff);

		wsManager.broadcast<PerfSnapshot>({
			channel: 'perf',
			event: 'sample',
			data: snapshot,
		});
	}
}

export const perfManager = new PerfManager();
