export type ManagedKey =
	| 'onesync'
	| 'resource-api-token'
	| 'api-port'
	| 'fxmanager-resource';

export interface ManagedConvarHit {
	line: number;
	key: ManagedKey;
}

const MANAGED_CONVARS: Record<string, ManagedKey> = {
	onesync: 'onesync',
	'resource-api-token': 'resource-api-token',
	'api-port': 'api-port',
};

const SETTERS = new Set(['set', 'setr', 'sets']);
const RESOURCE_COMMANDS = new Set(['ensure', 'start', 'stop', 'restart']);
const TOKEN_RE = /"([^"]*)"|(\S+)/g;

function tokenize(line: string): string[] {
	const tokens: string[] = [];
	TOKEN_RE.lastIndex = 0;
	let match: RegExpExecArray | null = TOKEN_RE.exec(line);
	while (match !== null) {
		const raw = match[2];
		if (raw !== undefined && (raw.startsWith('#') || raw.startsWith('//'))) {
			break;
		}
		const token = match[1] ?? match[2];
		if (token !== undefined) tokens.push(token);
		match = TOKEN_RE.exec(line);
	}
	return tokens;
}

export function detectManagedConvars(text: string): ManagedConvarHit[] {
	const hits: ManagedConvarHit[] = [];

	text.split(/\r?\n/).forEach((rawLine, index) => {
		const tokens = tokenize(rawLine);
		const command = tokens[0]?.toLowerCase();
		if (!command) return;

		const line = index + 1;

		if (SETTERS.has(command)) {
			const key = MANAGED_CONVARS[tokens[1]?.toLowerCase() ?? ''];
			if (key) hits.push({ line, key });
			return;
		}

		const bareConvar = MANAGED_CONVARS[command];
		if (bareConvar && tokens.length >= 2) {
			hits.push({ line, key: bareConvar });
			return;
		}

		if (
			RESOURCE_COMMANDS.has(command) &&
			tokens[1]?.toLowerCase() === 'fxmanager'
		) {
			hits.push({ line, key: 'fxmanager-resource' });
		}
	});

	return hits;
}
