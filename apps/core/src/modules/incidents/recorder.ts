import type { IncidentEvent, IncidentEventKind } from '@fxmanager/shared/types';
import { redactIncidentData, redactIncidentText } from './redact';

type PendingEvent = Omit<IncidentEvent, 'id'>;
interface RecorderStore {
	append(events: PendingEvent[]): void;
	prune(now?: number): void;
}

/** Bounded, batched writes keep console bursts off the process output hot path. */
export class IncidentRecorder {
	private pending: PendingEvent[] = [];
	private dropped = 0;
	private timer: ReturnType<typeof setInterval> | null = null;
	private lastPrune = 0;
	private lastError = 0;
	constructor(
		private readonly store: RecorderStore,
		private readonly secrets: () => string[] = () => [],
	) {}

	start() {
		if (this.timer) return;
		this.timer = setInterval(() => this.flush(), 1000);
		this.timer.unref?.();
		this.record(
			'server',
			'Incident recorder started; earlier unrecorded history is unavailable',
		);
		this.flush();
	}

	record(
		kind: IncidentEventKind,
		summary: string,
		data: Record<string, unknown> = {},
		ts = Date.now(),
	) {
		// No capture until migrations and boot have completed.
		if (!this.timer) return;
		if (this.pending.length >= 2000) {
			this.dropped++;
			return;
		}
		try {
			const secrets = this.secrets();
			const cleaned = redactIncidentData(data, secrets);
			this.pending.push({
				ts,
				kind,
				summary: redactIncidentText(summary, secrets).slice(0, 4000),
				data:
					Buffer.byteLength(JSON.stringify(cleaned)) <= 8192
						? cleaned
						: { truncated: true },
			});
		} catch {
			this.dropped++;
		}
	}

	flush() {
		if (!this.timer && this.pending.length === 0 && this.dropped === 0) return;
		const batch = this.pending;
		const lost = this.dropped + batch.length;
		this.pending = [];
		if (this.dropped)
			batch.push({
				ts: Date.now(),
				kind: 'gap',
				summary: `${this.dropped} events could not be recorded`,
				data: { dropped: this.dropped },
			});
		this.dropped = 0;
		let appended = false;
		try {
			if (batch.length) this.store.append(batch);
			appended = true;
			if (batch.length || Date.now() - this.lastPrune >= 60_000) {
				this.store.prune();
				this.lastPrune = Date.now();
			}
		} catch {
			if (!appended) this.dropped += lost;
			if (Date.now() - this.lastError > 60_000) {
				console.error(
					'[incidents] Recording failed; missing events will be marked when storage recovers.',
				);
				this.lastError = Date.now();
			}
		}
	}

	stop() {
		this.record('server', 'Incident recorder stopped');
		this.flush();
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
	}
}
