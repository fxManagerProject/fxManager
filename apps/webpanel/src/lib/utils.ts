import { toast } from 'sonner';

export function formatDuration(milliseconds: number): string {
	const minutes = Math.floor(milliseconds / 60_000);
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function formatUptime(startedAt: Date | string | number): string {
	const initialDate =
		startedAt instanceof Date ? startedAt : new Date(startedAt);

	return formatDuration(Date.now() - initialDate.getTime());
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
