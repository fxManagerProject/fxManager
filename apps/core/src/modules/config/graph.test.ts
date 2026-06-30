import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { buildCfgGraph, findEditableNode, resolveNewCfgPath } from './graph';

const noSymlinks = async (p: string) => path.resolve(p);

const reader = (files: Record<string, string>) => async (p: string) => {
	const norm = p.replace(/\\/g, '/');
	const content = files[norm];
	if (content !== undefined) return content;
	throw new Error(`ENOENT: ${norm}`);
};

describe('buildCfgGraph', () => {
	it('returns only the root file when there are no exec directives', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'sv_hostname "hi"',
			}),
		});

		expect(nodes).toHaveLength(1);
		expect(nodes[0]).toMatchObject({
			displayPath: 'server.cfg',
			depth: 0,
			exists: true,
		});
	});

	it('walks exec includes depth-first with incrementing depth', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec a.cfg\nexec b.cfg',
				'/srv/a.cfg': 'exec c.cfg',
				'/srv/b.cfg': 'sv_maxclients 48',
				'/srv/c.cfg': 'sv_hostname "deep"',
			}),
		});

		expect(nodes.map((n) => [n.displayPath, n.depth])).toEqual([
			['server.cfg', 0],
			['a.cfg', 1],
			['c.cfg', 2],
			['b.cfg', 1],
		]);
	});

	it('resolves exec paths relative to the data dir, not the parent cfg', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec cfg/a.cfg',
				'/srv/cfg/a.cfg': 'exec b.cfg',
				'/srv/b.cfg': 'sv_hostname "root-relative"',
			}),
		});

		expect(nodes.map((n) => n.displayPath)).toEqual([
			'server.cfg',
			'cfg/a.cfg',
			'b.cfg',
		]);
		expect(nodes.every((n) => n.exists)).toBe(true);
	});

	it('lists a file reachable from multiple execs only once', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec a.cfg\nexec b.cfg',
				'/srv/a.cfg': 'exec shared.cfg',
				'/srv/b.cfg': 'exec shared.cfg',
				'/srv/shared.cfg': 'sv_hostname "shared"',
			}),
		});

		const shared = nodes.filter((n) => n.displayPath === 'shared.cfg');
		expect(shared).toHaveLength(1);
	});

	it('does not loop on circular exec includes', async () => {
		const nodes = await buildCfgGraph('/srv/a.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/a.cfg': 'exec b.cfg',
				'/srv/b.cfg': 'exec a.cfg',
			}),
		});

		expect(nodes.map((n) => n.displayPath)).toEqual(['a.cfg', 'b.cfg']);
	});

	it('marks an unreadable exec target as missing and treats it as a leaf', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec missing.cfg',
			}),
		});

		expect(nodes).toHaveLength(2);
		expect(nodes[1]).toMatchObject({
			displayPath: 'missing.cfg',
			depth: 1,
			exists: false,
		});
	});

	it('does not follow exec includes that escape the data dir', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec ../outside.cfg\nexec sub/in.cfg',
				'/srv/sub/in.cfg': 'sv_hostname "ok"',
			}),
		});

		expect(nodes.map((n) => n.displayPath)).toEqual([
			'server.cfg',
			'sub/in.cfg',
		]);
	});

	it('does not follow absolute exec targets', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec /etc/passwd\nexec local.cfg',
				'/srv/local.cfg': 'sv_hostname "ok"',
			}),
		});

		expect(nodes.map((n) => n.displayPath)).toEqual([
			'server.cfg',
			'local.cfg',
		]);
	});

	it('skips @resource exec references', async () => {
		const nodes = await buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec @mymode/server.cfg',
			}),
		});

		expect(nodes).toHaveLength(1);
		expect(nodes[0]?.displayPath).toBe('server.cfg');
	});
});

describe('findEditableNode', () => {
	const graph = async () =>
		buildCfgGraph('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec cfg/perms.cfg',
				'/srv/cfg/perms.cfg': 'add_ace group.admin command allow',
			}),
		});

	it('finds a node by its relative display path', async () => {
		const node = findEditableNode(await graph(), '/srv', 'cfg/perms.cfg');
		expect(node?.displayPath).toBe('cfg/perms.cfg');
	});

	it('finds a node by an absolute path', async () => {
		const node = findEditableNode(await graph(), '/srv', '/srv/server.cfg');
		expect(node?.displayPath).toBe('server.cfg');
	});

	it('returns null for a file that is not part of the exec graph', async () => {
		const node = findEditableNode(await graph(), '/srv', 'secrets.cfg');
		expect(node).toBeNull();
	});

	it('blocks path traversal outside the graph', async () => {
		const node = findEditableNode(await graph(), '/srv', '../../etc/passwd');
		expect(node).toBeNull();
	});
});

describe('resolveNewCfgPath', () => {
	it('accepts a simple .cfg name', async () => {
		const r = await resolveNewCfgPath('/srv', 'routing.cfg', {
			realpath: noSymlinks,
		});
		expect(r).toMatchObject({ ok: true, displayPath: 'routing.cfg' });
	});

	it('accepts a nested .cfg path', async () => {
		const r = await resolveNewCfgPath('/srv', 'cfgs/routing.cfg', {
			realpath: noSymlinks,
		});
		expect(r).toMatchObject({ ok: true, displayPath: 'cfgs/routing.cfg' });
	});

	it('accepts an uppercase .CFG extension', async () => {
		const r = await resolveNewCfgPath('/srv', 'routing.CFG', {
			realpath: noSymlinks,
		});
		expect(r.ok).toBe(true);
	});

	it('rejects a non-.cfg extension', async () => {
		const r = await resolveNewCfgPath('/srv', 'routing.txt', {
			realpath: noSymlinks,
		});
		expect(r.ok).toBe(false);
	});

	it('rejects an empty name', async () => {
		expect((await resolveNewCfgPath('/srv', '   ')).ok).toBe(false);
	});

	it('rejects path traversal', async () => {
		expect((await resolveNewCfgPath('/srv', '../evil.cfg')).ok).toBe(false);
	});

	it('rejects an absolute path outside the data dir', async () => {
		expect((await resolveNewCfgPath('/srv', '/etc/evil.cfg')).ok).toBe(false);
	});

	it('rejects a target reached through a symlinked directory', async () => {
		// `/srv/link` is a symlink escaping to `/etc`; a lexical check alone
		// would accept `link/evil.cfg`.
		const realpath = async (p: string) => {
			const norm = path.resolve(p).replace(/\\/g, '/');
			if (norm.endsWith('/srv/link')) return path.resolve('/etc');
			return path.resolve(p);
		};
		const r = await resolveNewCfgPath('/srv', 'link/evil.cfg', { realpath });
		expect(r.ok).toBe(false);
	});
});
