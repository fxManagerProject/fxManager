import { readFile as fsReadFile, realpath as fsRealpath } from 'node:fs/promises';
import path from 'node:path';
import { parseEndpointCommands } from '../../common/fxserver-endpoint';

type ReadFile = (path: string) => Promise<string>;
type RealPath = (path: string) => Promise<string>;

export interface CfgGraphNode {
	path: string;
	displayPath: string;
	depth: number;
	exists: boolean;
}

function toDisplayPath(dataDir: string, absPath: string): string {
	return path.relative(dataDir, absPath).replace(/\\/g, '/');
}

async function safeRealpath(
	realpath: RealPath,
	target: string,
): Promise<string> {
	try {
		return await realpath(target);
	} catch {
		return path.resolve(target);
	}
}

function isWithin(realDataDir: string, target: string): boolean {
	const rel = path.relative(realDataDir, target);
	return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

async function realAncestorWithin(
	realpath: RealPath,
	realDataDir: string,
	target: string,
): Promise<boolean> {
	let dir = path.dirname(target);
	for (;;) {
		try {
			return isWithin(realDataDir, await realpath(dir));
		} catch {
			const parent = path.dirname(dir);
			if (parent === dir) return false;
			dir = parent;
		}
	}
}

export async function buildCfgGraph(
	entryCfgPath: string,
	opts: { dataDir: string; readFile?: ReadFile; realpath?: RealPath },
): Promise<CfgGraphNode[]> {
	const readFile = opts.readFile ?? ((p) => fsReadFile(p, 'utf8'));
	const realpath = opts.realpath ?? fsRealpath;
	const { dataDir } = opts;
	const realDataDir = await safeRealpath(realpath, dataDir);
	const nodes: CfgGraphNode[] = [];
	const visited = new Set<string>();

	const walk = async (cfgPath: string, depth: number): Promise<void> => {
		const resolved = path.resolve(cfgPath);
		if (visited.has(resolved)) return;
		visited.add(resolved);

		let text: string | null = null;
		try {
			text = await readFile(cfgPath);
		} catch {
			text = null;
		}

		nodes.push({
			path: resolved,
			displayPath: toDisplayPath(dataDir, resolved),
			depth,
			exists: text !== null,
		});

		if (text === null) return;

		const { execs } = parseEndpointCommands(text);
		for (const exec of execs) {
			if (exec.startsWith('@')) continue; // @resource/foo.cfg not supported
			if (path.isAbsolute(exec)) continue; // no absolute include targets
			const realChild = await safeRealpath(realpath, path.resolve(dataDir, exec));
			if (!isWithin(realDataDir, realChild)) continue;
			await walk(path.join(dataDir, exec), depth + 1);
		}
	};

	await walk(entryCfgPath, 0);
	return nodes;
}

export function findEditableNode(
	graph: CfgGraphNode[],
	dataDir: string,
	requestPath: string,
): CfgGraphNode | null {
	const resolved = path.resolve(dataDir, requestPath);
	return graph.find((node) => node.path === resolved) ?? null;
}

export async function resolveNewCfgPath(
	dataDir: string,
	requestPath: string,
	opts: { realpath?: RealPath } = {},
): Promise<
	| { ok: true; abs: string; displayPath: string }
	| { ok: false; error: string }
> {
	const realpath = opts.realpath ?? fsRealpath;
	const trimmed = requestPath.trim();
	if (!trimmed) return { ok: false, error: 'File name is required' };
	if (!/\.cfg$/i.test(trimmed)) {
		return { ok: false, error: 'Only .cfg files are supported' };
	}

	const root = path.resolve(dataDir);
	const abs = path.resolve(dataDir, trimmed);
	const rel = path.relative(root, abs);
	if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
		return { ok: false, error: 'Path must stay within the server-data folder' };
	}

	const realDataDir = await safeRealpath(realpath, dataDir);
	if (!(await realAncestorWithin(realpath, realDataDir, abs))) {
		return { ok: false, error: 'Path must stay within the server-data folder' };
	}

	return { ok: true, abs, displayPath: rel.replace(/\\/g, '/') };
}
