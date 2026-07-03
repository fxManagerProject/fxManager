import type { ProcessState } from '@fxmanager/shared/types';
import { toast } from 'sonner';

export function formatDuration(
	ms: number,
	showSeconds: boolean = true,
): string {
	const totalSeconds = Math.floor(ms / 1000);
	const h = Math.floor(totalSeconds / 3600);
	const m = Math.floor((totalSeconds % 3600) / 60);
	const s = totalSeconds % 60;

	if (!showSeconds) {
		if (h > 0) return `${h}h ${m}m`;
		return `${m}m`;
	}

	if (h > 0) return `${h}h ${m}m`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

export function formatRemaining(ms: number, prefix?: string): string {
	if (ms <= 0) return 'now';
	return prefix ? `${prefix} ${formatDuration(ms)}` : formatDuration(ms);
}

export function formatDate(date: Date | string | null | undefined): string {
	if (!date) return '—';
	return new Intl.DateTimeFormat('en-GB', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(date));
}

export function computeExpiry(
	duration: number,
	unit: 'hours' | 'days' | 'weeks',
): Date | null {
	if (!duration || duration <= 0) return null;
	const ms = { hours: 36e5, days: 864e5, weeks: 6048e5 }[unit];
	return new Date(Date.now() + duration * ms);
}

export function initials(name: string): string {
	return name
		.split(' ')
		.map((w) => w[0])
		.join('')
		.slice(0, 2)
		.toUpperCase();
}

export async function copyToClipboard(
	value: string,
	confirmation: string | null = null,
) {
	try {
		await navigator.clipboard.writeText(value);

		toast.info('Copied to clipboard', { description: confirmation });
	} catch (err) {
		console.error('Failed to copy!', err);
		toast.error('Failed to copy to clipboard.', { richColors: true });
	}
}
const SERVER_RUNNING_STATES: ProcessState[] = [
	'running',
	'starting',
	'stopping',
];

export function isServerRunning(status?: ProcessState): boolean {
	return status ? SERVER_RUNNING_STATES.includes(status) : false;
}
