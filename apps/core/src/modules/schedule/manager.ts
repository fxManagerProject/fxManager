import { repo } from '@fxmanager/database';
import type { RestartScheduleStatus } from '@fxmanager/shared/types';
import { txAdminCompat } from '../txadmin/compat';
import {
	WARNING_THRESHOLDS,
	computeNextRestart,
	formatCountdown,
	parseTimes,
} from './time';

const TICK_MS = 1_000;

interface RestartablePm {
	getState(): { status: string };
	restart(opts?: { author?: string; message?: string }): Promise<boolean>;
}

function minutesToHHMM(m: number): string {
	const h = Math.floor(m / 60);
	return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

type TargetKind = 'temp' | 'daily';

export class RestartScheduler {
	private pm: RestartablePm | null = null;
	private enabled = false;
	private minutes: number[] = [];
	private tempTarget: number | null = null;
	private currentTarget: number | null = null;
	private currentKind: TargetKind | null = null;
	private firedThresholds = new Set<number>();
	private skippedTime: number | null = null;
	private restarting = false;
	private timer: ReturnType<typeof setInterval> | null = null;

	attach(pm: RestartablePm): void {
		this.pm = pm;
	}

	start(pm: RestartablePm, opts?: { tickMs?: number }): void {
		this.attach(pm);
		this.reload();
		this.timer = setInterval(
			() => this.tick(new Date()),
			opts?.tickMs ?? TICK_MS,
		);
		this.timer.unref?.();
	}

	stop(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = null;
		}
	}

	reload(): void {
		const settings = repo.settings.getMultiple([
			'restarts.enabled',
			'restarts.times',
		]);
		this.enabled = settings['restarts.enabled'] === 'true';
		this.minutes = parseTimes(settings['restarts.times'] ?? '');
		this.currentTarget = null;
		this.firedThresholds.clear();
	}

	private effectiveTarget(now: Date): { at: number; kind: TargetKind } | null {
		const nowMs = now.getTime();
		const candidates: { at: number; kind: TargetKind }[] = [];

		if (this.tempTarget !== null && this.tempTarget > nowMs) {
			candidates.push({ at: this.tempTarget, kind: 'temp' });
		}
		if (this.enabled && this.minutes.length > 0) {
			const daily = computeNextRestart(this.minutes, now);
			if (daily) candidates.push({ at: daily.getTime(), kind: 'daily' });
		}

		if (candidates.length === 0) return null;
		candidates.sort((a, b) => a.at - b.at);
		return candidates[0] ?? null;
	}

	getStatus(now = new Date()): RestartScheduleStatus {
		const next = this.effectiveTarget(now);
		return {
			enabled: this.enabled,
			times: this.minutes.map(minutesToHHMM),
			nextRestart: next ? new Date(next.at).toISOString() : null,
			temporary: next?.kind === 'temp',
			skipped: this.skippedTime !== null,
		};
	}

	scheduleTemp(minutes: number, now = new Date()): { nextRestart: string } {
		const at = now.getTime() + Math.max(1, Math.round(minutes)) * 60_000;
		this.tempTarget = at;
		this.currentTarget = null;
		this.tick(now);
		return { nextRestart: new Date(at).toISOString() };
	}

	skipNext(
		author: string,
		now = new Date(),
	): { skipped: boolean; nextRestart: string | null } {
		const next = this.effectiveTarget(now);
		if (!next) return { skipped: false, nextRestart: null };

		if (next.kind === 'temp') {
			this.tempTarget = null;
		} else {
			this.skippedTime = next.at;
		}
		this.currentTarget = null;

		const secondsRemaining = Math.max(
			0,
			Math.round((next.at - now.getTime()) / 1000),
		);
		void txAdminCompat.emit('scheduledRestartSkipped', {
			secondsRemaining,
			temporary: next.kind === 'temp',
			author,
		});

		return { skipped: true, nextRestart: new Date(next.at).toISOString() };
	}

	tick(now: Date): void {
		if (this.currentTarget === null) {
			const next = this.effectiveTarget(now);
			if (!next) {
				this.currentKind = null;
				this.firedThresholds.clear();
				return;
			}
			this.setCurrentTarget(next.at, next.kind, now);
		} else if (
			this.tempTarget !== null &&
			this.tempTarget > now.getTime() &&
			this.tempTarget < this.currentTarget
		) {
			this.setCurrentTarget(this.tempTarget, 'temp', now);
		}

		const target = this.currentTarget;
		if (target === null) return;

		const secondsRemaining = (target - now.getTime()) / 1000;

		if (secondsRemaining <= 0) {
			if (this.skippedTime === target) {
				this.skippedTime = null;
			} else if (!this.restarting && this.pm?.getState().status === 'running') {
				this.triggerRestart();
			}
			if (this.currentKind === 'temp') this.tempTarget = null;
			this.currentTarget = null;
			return;
		}

		if (this.skippedTime === target) return;

		for (const threshold of WARNING_THRESHOLDS) {
			if (
				secondsRemaining <= threshold &&
				!this.firedThresholds.has(threshold)
			) {
				this.firedThresholds.add(threshold);
				void txAdminCompat.emit('scheduledRestart', {
					secondsRemaining: threshold,
					translatedMessage: formatCountdown(threshold),
				});
			}
		}
	}

	private setCurrentTarget(at: number, kind: TargetKind, now: Date): void {
		this.currentTarget = at;
		this.currentKind = kind;
		this.firedThresholds.clear();
		const initial = (at - now.getTime()) / 1000;
		for (const threshold of WARNING_THRESHOLDS) {
			if (threshold > initial) this.firedThresholds.add(threshold);
		}
	}

	private triggerRestart(): void {
		this.restarting = true;
		void this.pm
			?.restart({ author: 'Scheduler', message: 'Scheduled restart' })
			.finally(() => {
				this.restarting = false;
			});
	}
}

export const restartScheduler = new RestartScheduler();
