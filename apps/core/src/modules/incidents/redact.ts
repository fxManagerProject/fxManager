const OMITTED = '[REDACTED]';

/** Redact before persistence, and again at export for newly configured secrets. */
export function redactIncidentText(
	text: string,
	secrets: readonly string[] = [],
): string {
	let result = text;
	for (const secret of [...new Set(secrets)]
		.filter((s) => s.length >= 4)
		.sort((a, b) => b.length - a.length)) {
		result = result.split(secret).join(OMITTED);
	}
	// biome-ignore lint/suspicious/noControlCharactersInRegex: strip terminal ANSI escape sequences before storage
	const withoutAnsi = result.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
	const printable = withoutAnsi.replace(
		// biome-ignore lint/suspicious/noControlCharactersInRegex: strip non-printing controls while preserving newlines and tabs
		/[\u0000-\u0008\u000b-\u001f\u007f]/g,
		'',
	);
	return printable
		.replace(
			/\b(?:license2?|steam|discord|fivem|xbl|live|ip):[^\s,;"'<>]+/gi,
			OMITTED,
		)
		.replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, OMITTED)
		.replace(/\b(?:[a-f\d]{0,4}:){2,}[a-f\d:]{0,39}\b/gi, OMITTED)
		.replace(
			/\b(?:https?:\/\/)?(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/[^\s"']+/gi,
			OMITTED,
		)
		.replace(/\b(?:mysql|postgres(?:ql)?):\/\/[^\s"']+/gi, OMITTED)
		.replace(
			/\b(?:sv_licenseKey|steam_webApiKey|mysql_connection_string|password|secret|token|authorization|cookie|api[_-]?key|resource-api-token)\b["']?\s*(?:[=:]\s*|\s+)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\r\n]+)/gi,
			OMITTED,
		);
}

export function redactIncidentData(
	value: Record<string, unknown>,
	secrets: readonly string[] = [],
): Record<string, unknown> {
	const clean = (item: unknown, depth: number): unknown => {
		if (depth > 6) return '[TRUNCATED]';
		if (typeof item === 'string')
			return redactIncidentText(item, secrets).slice(0, 4000);
		if (typeof item === 'number') return Number.isFinite(item) ? item : null;
		if (typeof item === 'boolean' || item === null) return item;
		if (Array.isArray(item))
			return item.slice(0, 100).map((entry) => clean(entry, depth + 1));
		if (typeof item === 'object')
			return Object.fromEntries(
				Object.entries(item)
					.slice(0, 50)
					.map(([key, entry]) => [
						key,
						/identifier|license|password|secret|token|cookie|authorization|playerId|serverId|discordId|^ip$/i.test(
							key,
						)
							? OMITTED
							: clean(entry, depth + 1),
					]),
			);
		return null;
	};
	return clean(value, 0) as Record<string, unknown>;
}
