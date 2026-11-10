import { expect, test } from 'bun:test';
const handlers = new Map<
	string,
	(request: unknown, reply: (response: { body: string }) => void) => void
>();
Object.assign(globalThis, {
	RegisterRawNuiCallback: (
		name: string,
		handler: (
			request: unknown,
			reply: (response: { body: string }) => void,
		) => void,
	) => handlers.set(name, handler),
});
const { NuiCallback } = await import('./nui-callbacks');
test('NUI responses preserve booleans and null instead of turning them into truthy objects', () => {
	for (const value of [true, false, null, [], { success: false }]) {
		NuiCallback<unknown, unknown>('test', (_, reply) => reply(value));
		let body = '';
		handlers.get('test')!(
			{ headers: { Origin: 'https://cfx-nui-fxmanager' }, body: '{}' },
			(response) => {
				body = response.body;
			},
		);
		expect(JSON.parse(body)).toEqual(value);
	}
});
