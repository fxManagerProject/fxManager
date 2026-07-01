export const WARNING_THRESHOLDS = [
	1800, 900, 600, 300, 240, 180, 120, 60,
] as const;

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function parseTimes(csv: string): number[] {
	const minutes = new Set<number>();

	for (const raw of csv.split(',')) {
		const match = TIME_RE.exec(raw.trim());
		if (!match) continue;

		const hours = Number(match[1]);
		const mins = Number(match[2]);
		if (hours > 23 || mins > 59) continue;

		minutes.add(hours * 60 + mins);
	}

	return [...minutes].sort((a, b) => a - b);
}

export function computeNextRestart(minutes: number[], now: Date): Date | null {
	let best: Date | null = null;

	for (const m of minutes) {
		const candidate = new Date(now);
		candidate.setHours(Math.floor(m / 60), m % 60, 0, 0);
		if (candidate.getTime() <= now.getTime()) {
			candidate.setDate(candidate.getDate() + 1);
		}
		if (!best || candidate.getTime() < best.getTime()) best = candidate;
	}

	return best;
}

export function formatCountdown(seconds: number): string {
	if (seconds >= 60 && seconds % 60 === 0) {
		const m = seconds / 60;
		return `Server restarting in ${m} minute${m === 1 ? '' : 's'}`;
	}
	return `Server restarting in ${seconds} second${seconds === 1 ? '' : 's'}`;
}
