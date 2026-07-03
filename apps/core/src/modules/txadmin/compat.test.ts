/** biome-ignore-all lint/suspicious/noExplicitAny: mocking singletons and fetch */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';

mock.module('@fxmanager/database', () => ({ repo: {} }));
mock.module('../../common/fxserver-endpoint', () => ({
	getServerNetEndpoint: async () => '127.0.0.1:30120',
}));

import { ConfigManager } from '../config/manager';
const { txAdminCompat } = await import('./compat');

describe('txAdminCompat.emit', () => {
	const originalFetch = global.fetch;

	beforeEach(() => {
		spyOn(ConfigManager, 'getInstance').mockReturnValue({
			getSystemValues: () => ({ resourceApiToken: 'mock-token' }),
		} as any);
	});

	afterEach(() => {
		global.fetch = originalFetch;
		mock.restore();
	});

	it('POSTs the event envelope to the resource with the api token', async () => {
		global.fetch = mock(async () => ({ ok: true }) as Response) as any;

		await txAdminCompat.emit('serverShuttingDown', {
			delay: 1000,
			author: 'admin',
			message: 'bye',
		});

		expect(global.fetch).toHaveBeenCalledWith(
			'http://127.0.0.1:30120/fxManager/txadmin/event',
			{
				method: 'POST',
				body: JSON.stringify({
					event: 'serverShuttingDown',
					data: { delay: 1000, author: 'admin', message: 'bye' },
				}),
				headers: {
					Application: 'json/application',
					'x-resource-token': 'mock-token',
				},
			},
		);
	});

	it('resolves without throwing when the resource is unreachable', async () => {
		global.fetch = mock(async () => {
			throw new Error('Connection Refused');
		}) as any;

		await expect(
			txAdminCompat.emit('playerKicked', {
				target: 3,
				author: 'admin',
				reason: 'x',
				dropMessage: 'y',
			}),
		).resolves.toBeUndefined();
	});

	it('does not throw when the resource responds non-ok', async () => {
		global.fetch = mock(
			async () =>
				({ ok: false, status: 401, statusText: 'Unauthorized' }) as Response,
		) as any;

		await expect(
			txAdminCompat.emit('playerWarned', {
				author: 'admin',
				reason: 'x',
				actionId: '1',
				targetNetId: 3,
				targetIds: ['license:abc'],
				targetName: 'Bob',
			}),
		).resolves.toBeUndefined();
	});
});
