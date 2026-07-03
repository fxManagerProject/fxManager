import { describe, expect, it } from 'bun:test';
import {
	DEFAULT_NET_ENDPOINT,
	forceLoopbackHost,
	getServerNetEndpoint,
	parseEndpointCommands,
	pickConnectEndpoint,
	resolveCfgEndpoint,
} from './fxserver-endpoint';

describe('parseEndpointCommands', () => {
	it('collects tcp and udp entries for the same ip:port', () => {
		const cfg = `
			endpoint_add_tcp "0.0.0.0:30120"
			endpoint_add_udp "0.0.0.0:30120"
		`;
		const { endpoints } = parseEndpointCommands(cfg);
		expect(endpoints['0.0.0.0:30120']).toEqual({ tcp: true, udp: true });
	});

	it('extracts exec include paths', () => {
		const cfg = `
			exec endpoints.cfg
			exec "cfg/perms.cfg"
		`;
		const { execs } = parseEndpointCommands(cfg);
		expect(execs).toEqual(['endpoints.cfg', 'cfg/perms.cfg']);
	});

	it('ignores commented-out lines', () => {
		const cfg = `
			# endpoint_add_tcp "1.2.3.4:30120"
			endpoint_add_tcp "0.0.0.0:30120"
		`;
		const { endpoints } = parseEndpointCommands(cfg);
		expect(endpoints['1.2.3.4:30120']).toBeUndefined();
		expect(endpoints['0.0.0.0:30120']).toEqual({ tcp: true });
	});
});

describe('pickConnectEndpoint', () => {
	it('picks the endpoint present in both tcp and udp', () => {
		const endpoint = pickConnectEndpoint({
			'0.0.0.0:30120': { tcp: true, udp: true },
			'0.0.0.0:40120': { tcp: true },
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('normalizes the 0.0.0.0 wildcard bind address to 127.0.0.1', () => {
		const endpoint = pickConnectEndpoint({
			'0.0.0.0:30120': { tcp: true, udp: true },
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('normalizes the [::] ipv6 wildcard to 127.0.0.1', () => {
		const endpoint = pickConnectEndpoint({
			'[::]:30120': { tcp: true, udp: true },
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('keeps an explicit bind address untouched', () => {
		const endpoint = pickConnectEndpoint({
			'192.168.1.5:30120': { tcp: true, udp: true },
		});
		expect(endpoint).toBe('192.168.1.5:30120');
	});

	it('returns null when no endpoint is in both tcp and udp', () => {
		const endpoint = pickConnectEndpoint({
			'0.0.0.0:30120': { tcp: true },
		});
		expect(endpoint).toBeNull();
	});
});

describe('resolveCfgEndpoint', () => {
	const reader = (files: Record<string, string>) => async (p: string) => {
		const norm = p.replace(/\\/g, '/');
		const content = files[norm];
		if (content !== undefined) return content;
		throw new Error(`ENOENT: ${norm}`);
	};

	it('resolves the endpoint from a single cfg file', async () => {
		const endpoint = await resolveCfgEndpoint('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': `
					endpoint_add_tcp "0.0.0.0:30120"
					endpoint_add_udp "0.0.0.0:30120"
				`,
			}),
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('follows exec includes to find the endpoint', async () => {
		const endpoint = await resolveCfgEndpoint('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': 'exec endpoints.cfg',
				'/srv/endpoints.cfg': `
					endpoint_add_tcp "0.0.0.0:30120"
					endpoint_add_udp "0.0.0.0:30120"
				`,
			}),
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('skips unreadable exec includes but still resolves from the main cfg', async () => {
		const endpoint = await resolveCfgEndpoint('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/server.cfg': `
					exec missing.cfg
					endpoint_add_tcp "0.0.0.0:30120"
					endpoint_add_udp "0.0.0.0:30120"
				`,
			}),
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('does not loop forever on circular exec includes', async () => {
		const endpoint = await resolveCfgEndpoint('/srv/a.cfg', {
			dataDir: '/srv',
			readFile: reader({
				'/srv/a.cfg': 'exec b.cfg',
				'/srv/b.cfg': 'exec a.cfg',
			}),
		});
		expect(endpoint).toBeNull();
	});

	it('returns null when the entry cfg is unreadable', async () => {
		const endpoint = await resolveCfgEndpoint('/srv/server.cfg', {
			dataDir: '/srv',
			readFile: reader({}),
		});
		expect(endpoint).toBeNull();
	});
});

describe('forceLoopbackHost', () => {
	it('rewrites an explicit IPv4 bind to loopback, keeping the port', () => {
		expect(forceLoopbackHost('192.168.1.5:30120')).toBe('127.0.0.1:30120');
	});

	it('rewrites an explicit IPv6 bind to loopback, keeping the port', () => {
		expect(forceLoopbackHost('[fe80::1]:30120')).toBe('127.0.0.1:30120');
	});

	it('leaves an already-loopback endpoint unchanged', () => {
		expect(forceLoopbackHost('127.0.0.1:30120')).toBe('127.0.0.1:30120');
	});
});

describe('getServerNetEndpoint', () => {
	it('returns the resolved endpoint when the cfg is resolvable', async () => {
		const endpoint = await getServerNetEndpoint({
			cfgPath: '/srv/server.cfg',
			dataDir: '/srv',
			readFile: async () => `
				endpoint_add_tcp "0.0.0.0:30120"
				endpoint_add_udp "0.0.0.0:30120"
			`,
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('forces an explicit non-loopback bind onto loopback so the token never leaves the host', async () => {
		const endpoint = await getServerNetEndpoint({
			cfgPath: '/srv/server.cfg',
			dataDir: '/srv',
			readFile: async () => `
				endpoint_add_tcp "192.168.1.5:30120"
				endpoint_add_udp "192.168.1.5:30120"
			`,
		});
		expect(endpoint).toBe('127.0.0.1:30120');
	});

	it('falls back to the default endpoint when nothing resolves', async () => {
		const endpoint = await getServerNetEndpoint({
			cfgPath: '/srv/server.cfg',
			dataDir: '/srv',
			readFile: async () => {
				throw new Error('ENOENT');
			},
		});
		expect(endpoint).toBe(DEFAULT_NET_ENDPOINT);
		expect(endpoint).toBe('127.0.0.1:30120');
	});
});
