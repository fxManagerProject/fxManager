/** biome-ignore-all lint/suspicious/noExplicitAny lint/complexity/noBannedTypes: explicit any allows testing hidden state properties & mocking frames */
import { mock } from 'bun:test';

const mockLogin = mock(async () => 'mock-token');
const mockDestroy = mock(async () => {});
const mockGuildsFetch = mock(async () => ({}));

mock.module('discord.js', () => {
	return {
		GatewayIntentBits: { Guilds: 1, GuildMembers: 2 },
		Events: { ClientReady: 'ready' },
		Client: class MockClient {
			login = mockLogin;
			destroy = mockDestroy;
			guilds = { fetch: mockGuildsFetch };

			private listeners: Record<string, Function[]> = {};
			once(event: string, callback: Function) {
				if (!this.listeners[event]) this.listeners[event] = [];
				this.listeners[event].push(callback);
			}
			emit(event: string, ...args: any[]) {
				if (this.listeners[event]) {
					this.listeners[event].forEach((cb) => {
						cb(...args);
					});
				}
			}
		},
	};
});

export { mockLogin, mockDestroy, mockGuildsFetch };
