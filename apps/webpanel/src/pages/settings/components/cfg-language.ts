import { StreamLanguage, type StreamParser } from '@codemirror/language';

const COMMANDS = new Set([
	'exec',
	'ensure',
	'start',
	'stop',
	'restart',
	'refresh',
	'set',
	'setr',
	'sets',
	'seta',
	'add_ace',
	'remove_ace',
	'add_principal',
	'remove_principal',
	'endpoint_add_tcp',
	'endpoint_add_udp',
	'load_server_icon',
]);

const CONVARS = new Set([
	'onesync',
	'locale',
	'gamename',
	'rcon_password',
	'steam_webapikey',
]);

const ATOMS = new Set(['on', 'off', 'true', 'false', 'yes', 'no']);

const parser: StreamParser<unknown> = {
	token(stream) {
		if (stream.eatSpace()) return null;

		const ch = stream.peek();
		if (ch === '#') {
			stream.skipToEnd();
			return 'comment';
		}
		if (stream.match('//')) {
			stream.skipToEnd();
			return 'comment';
		}
		if (ch === '"') {
			stream.match(/^"(?:[^"\\]|\\.)*"?/);
			return 'string';
		}
		if (stream.match(/^-?\d+(?:\.\d+)?\b/)) return 'number';

		if (stream.match(/^[^\s"]+/)) {
			const word = stream.current().toLowerCase();
			if (COMMANDS.has(word)) return 'keyword';
			if (ATOMS.has(word)) return 'atom';
			if (word.startsWith('sv_') || CONVARS.has(word)) return 'variableName';
			return null;
		}

		stream.next();
		return null;
	},
	languageData: { commentTokens: { line: '#' } },
};

export const cfgLanguage = () => StreamLanguage.define(parser);
