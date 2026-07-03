// Endpoint resolution adapted from txAdmin's fxsConfigHelper (MIT,
// (c) 2019-2025 Take-Two Interactive Software, Inc.):
// https://github.com/citizenfx/txAdmin/blob/master/core/lib/fxserver/fxsConfigHelper.ts
import { readFile as fsReadFile } from 'node:fs/promises';
import path from 'node:path';
import { ConfigManager } from '../modules/config/manager';

export const DEFAULT_NET_ENDPOINT = '127.0.0.1:30120';

export interface EndpointFlags {
	tcp?: boolean;
	udp?: boolean;
}

export type EndpointMap = Record<string, EndpointFlags>;

type ReadFile = (path: string) => Promise<string>;

const TOKEN_RE = /"([^"]*)"|(\S+)/g;
const WILDCARD_RE = /(0\.0\.0\.0|\[::\])/;

function tokenizeLine(line: string): string[] {
	const tokens: string[] = [];
	TOKEN_RE.lastIndex = 0;
	let match: RegExpExecArray | null = TOKEN_RE.exec(line);
	while (match !== null) {
		const token = match[1] ?? match[2];
		if (token !== undefined) tokens.push(token);
		match = TOKEN_RE.exec(line);
	}
	return tokens;
}

export function parseEndpointCommands(text: string): {
	endpoints: EndpointMap;
	execs: string[];
} {
	const endpoints: EndpointMap = {};
	const execs: string[] = [];

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/#.*$/, '').trim();
		if (!line) continue;

		const [command, arg] = tokenizeLine(line);
		if (!command || !arg) continue;

		if (command === 'endpoint_add_tcp' || command === 'endpoint_add_udp') {
			const entry = endpoints[arg] ?? {};
			entry[command === 'endpoint_add_tcp' ? 'tcp' : 'udp'] = true;
			endpoints[arg] = entry;
		} else if (command === 'exec') {
			execs.push(arg);
		}
	}

	return { endpoints, execs };
}

export function pickConnectEndpoint(endpoints: EndpointMap): string | null {
	const both = Object.entries(endpoints).find(
		([, flags]) => flags.tcp && flags.udp,
	)?.[0];
	if (!both) return null;
	return both.replace(WILDCARD_RE, '127.0.0.1');
}

export function forceLoopbackHost(endpoint: string): string {
	const portIdx = endpoint.lastIndexOf(':');

	if (portIdx === -1) return endpoint;

	return `127.0.0.1:${endpoint.slice(portIdx + 1)}`;
}

export async function resolveCfgEndpoint(
	entryCfgPath: string,
	opts: { dataDir?: string; readFile?: ReadFile } = {},
): Promise<string | null> {
	const readFile = opts.readFile ?? ((p) => fsReadFile(p, 'utf8'));
	const merged: EndpointMap = {};
	const visited = new Set<string>();

	const walk = async (cfgPath: string): Promise<void> => {
		const resolved = path.resolve(cfgPath);
		if (visited.has(resolved)) return;
		visited.add(resolved);

		let text: string;
		try {
			text = await readFile(cfgPath);
		} catch {
			return;
		}

		const { endpoints, execs } = parseEndpointCommands(text);
		for (const [ep, flags] of Object.entries(endpoints)) {
			const entry = merged[ep] ?? {};
			if (flags.tcp) entry.tcp = true;
			if (flags.udp) entry.udp = true;
			merged[ep] = entry;
		}

		const baseDir = opts.dataDir ?? path.dirname(cfgPath);
		for (const exec of execs) {
			if (exec.startsWith('@')) continue; // @resource/foo.cfg not supported
			await walk(path.isAbsolute(exec) ? exec : path.join(baseDir, exec));
		}
	};

	await walk(entryCfgPath);
	return pickConnectEndpoint(merged);
}

export async function getServerNetEndpoint(
	opts: { cfgPath?: string; dataDir?: string; readFile?: ReadFile } = {},
): Promise<string> {
	let { cfgPath, dataDir } = opts;

	if (!cfgPath || !dataDir) {
		const cfg = ConfigManager.getInstance().getFxServerValues(true);
		dataDir ??= cfg.serverDataPath;
		cfgPath ??= path.isAbsolute(cfg.serverConfigFile)
			? cfg.serverConfigFile
			: path.join(cfg.serverDataPath, cfg.serverConfigFile);
	}

	const resolved = await resolveCfgEndpoint(cfgPath, {
		dataDir,
		readFile: opts.readFile,
	});
	return resolved ? forceLoopbackHost(resolved) : DEFAULT_NET_ENDPOINT;
}
