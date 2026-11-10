import { expect, mock, test } from 'bun:test';
let drop: (request: {
	body: { serverId: number; reason: string; license?: string };
}) => { status: number };
const dropped: string[] = [];
mock.module('../utils/env', () => ({ API_TOKEN: 'test-token' }));
mock.module('./class', () => ({
	HttpServer: class {
		post(name: string, _options: unknown, handler: typeof drop) {
			if (name === '/drop') drop = handler;
		}
		get() {}
	},
}));
Object.assign(globalThis, {
	GetPlayerIdentifierByType: () => 'license:replacement',
	DropPlayer: (id: string) => dropped.push(id),
});
await import('./index');
test('refuses to disconnect a new player occupying the old server ID', () => {
	expect(
		drop!({ body: { serverId: 12, reason: 'QA', license: 'license:original' } })
			.status,
	).toBe(409);
	expect(dropped).toEqual([]);
	expect(
		drop!({
			body: { serverId: 12, reason: 'QA', license: 'license:replacement' },
		}).status,
	).toBe(200);
	expect(dropped).toEqual(['12']);
});
