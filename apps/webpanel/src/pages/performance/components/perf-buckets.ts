// FXServer tickTime bucket upper-bounds (ms); the final band is the +Inf bucket.
const BUCKET_MS = [1, 2, 4, 6, 8, 10, 15, 20, 30, 50, 70, 100, 150, 250];
export const BAND_LABELS = [...BUCKET_MS.map(String), '+Inf'];
export const BANDS = BAND_LABELS.length;

/** Pretty label for a band index, e.g. `1ms` or `+Inf`. */
export function bandLabel(index: number): string {
	const raw = BAND_LABELS[index] ?? '';
	return raw === '+Inf' ? '+Inf' : `${raw}ms`;
}

/** Fastest band green, slowest red. */
export function bandColor(index: number): string {
	const hue = Math.round(140 * (1 - index / (BANDS - 1)));
	return `hsl(${hue} 70% 45%)`;
}
