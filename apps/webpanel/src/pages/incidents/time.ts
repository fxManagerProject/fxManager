export function localTime(ts: number) {
	const date = new Date(ts);
	return new Date(ts - date.getTimezoneOffset() * 60_000)
		.toISOString()
		.slice(0, 16);
}
export const dateText = (ts: number) => new Date(ts).toLocaleString();
