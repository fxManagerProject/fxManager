/** biome-ignore-all lint/suspicious/noExplicitAny lint/complexity/noBannedTypes: explicit any allows testing hidden state properties & mocking frames */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';
import { wsManager } from './manager'; // Adjust the import path as needed
import type { Channel, WSClientMessage } from '@fxmanager/shared/types';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';

interface MockWebSocket {
	readyState: number;
	on: ReturnType<typeof mock>;
	send: ReturnType<typeof mock>;
	simulateClientEvent: (event: 'message' | 'close', data?: any) => void;
}

function createMockSocket(initialReadyState = 1): MockWebSocket {
	const eventRegistry: Record<string, Function[]> = {};

	const onMock = mock((event: string, callback: Function) => {
		if (!eventRegistry[event]) eventRegistry[event] = [];
		eventRegistry[event].push(callback);
	});

	const sendMock = mock((_payload: string) => {});

	return {
		readyState: initialReadyState,
		on: onMock,
		send: sendMock,
		simulateClientEvent: (event: 'message' | 'close', data?: any) => {
			eventRegistry[event]?.forEach((cb) => {
				cb(data);
			});
		},
	};
}

describe('WSManager Suite', () => {
	let consoleErrorSpy: any;
	let methodSpies: any[] = [];

	beforeEach(() => {
		// Intercept console.error to keep the test runner console clean on caught exceptions
		consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});

		// 1. Instantiate a pristine fresh instance of the class from the singleton's constructor
		const freshInstance = new (wsManager.constructor as any)();

		// 2. Intercept and proxy all public methods to the fresh instance for absolute isolation
		const prototype = Object.getPrototypeOf(wsManager);
		Object.getOwnPropertyNames(prototype).forEach((key) => {
			if (
				typeof (wsManager as any)[key] === 'function' &&
				key !== 'constructor'
			) {
				const spy = spyOn(wsManager, key as any).mockImplementation(
					(...args: any[]) => {
						return freshInstance[key](...args);
					},
				);
				methodSpies.push(spy);
			}
		});
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		// Clean up all dynamically injected method spies to avoid contaminating other test suites
		methodSpies.forEach((spy) => {
			spy.mockRestore();
		});
		methodSpies = [];
	});

	describe('Client Lifecycle Management (add / remove)', () => {
		it('should cleanly register a connection state and bind essential event channels', () => {
			const mockSocket = createMockSocket();
			const mockAdmin = { username: 'test_admin', permissions: ['root'] };

			wsManager.add('client-uuid-1', mockSocket as any, mockAdmin as any);

			expect(mockSocket.on).toHaveBeenCalledWith(
				'message',
				expect.any(Function),
			);
			expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function));

			// Assert registration behavior: client receives targeted outbound messages correctly
			const testMsg = {
				channel: 'console' as Channel,
				event: 'line',
				data: 'Verified',
			};
			wsManager.send('client-uuid-1', testMsg);
			expect(mockSocket.send).toHaveBeenCalledWith(JSON.stringify(testMsg));
		});

		it('should drop tracking references automatically when an upstream socket triggers close events', () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-uuid-2', mockSocket as any, {} as any);

			// Fire a simulated termination event from the engine context
			mockSocket.simulateClientEvent('close');

			// Assert removal behavior: messages sent to this ID no longer transmit anywhere
			mockSocket.send.mockClear();
			wsManager.send('client-uuid-2', {
				channel: 'console',
				event: 'line',
				data: 'Drop test',
			});
			expect(mockSocket.send).not.toHaveBeenCalled();
		});

		it('should ignore incoming payload strings that fail to match valid JSON formatting schemas', () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-uuid-3', mockSocket as any, {} as any);

			// Should hit the try-catch block internally and safely suppress it
			expect(() => {
				mockSocket.simulateClientEvent(
					'message',
					Buffer.from('NOT_A_VALID_JSON_STRING'),
				);
			}).not.toThrow();
		});
	});

	describe('Subscription Routing and Authorization Hooks', () => {
		it('should allow channel subscriptions if no conditional connectionChecks are declared', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			const subscribeMessage: WSClientMessage = {
				type: 'subscribe',
				channel: 'playerlist',
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(subscribeMessage)),
			);

			// Yield event micro-tasks
			await Promise.resolve();

			// Assert subscription behavior: active broadcasts are successfully delivered to the subscriber
			const broadcastMsg = {
				channel: 'playerlist' as Channel,
				event: 'player_joined',
				data: {},
			};
			wsManager.broadcast(broadcastMsg);
			expect(mockSocket.send).toHaveBeenCalledWith(
				JSON.stringify(broadcastMsg),
			);
		});

		it('should enforce connection check rules and reject subscriptions on verification failures', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('user-id', mockSocket as any, { permissions: [] } as any);

			// Register checking rule mimicking your actual deployment hooks
			wsManager.addCheck('console', (admin) =>
				PermissionManager.has(
					admin.permissions,
					UserPermissions.CONSOLE_ACCESS,
				),
			);

			const subscribeAttempt: WSClientMessage = {
				type: 'subscribe',
				channel: 'console',
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(subscribeAttempt)),
			);

			await Promise.resolve();

			// Assert rejection behavior: broadcasts to this channel are blocked from reaching the client
			const broadcastMsg = {
				channel: 'console' as Channel,
				event: 'line',
				data: 'Secured',
			};
			wsManager.broadcast(broadcastMsg);
			expect(mockSocket.send).not.toHaveBeenCalled();
		});

		it('should securely fall back onto structural wildcard routing definitions (*)', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('user-id', mockSocket as any, { permissions: [] } as any);

			// Dynamic namespace matching validation (e.g. report:123 matching report:*)
			wsManager.addCheck('report:*' as any, () => false);

			const subscribeAttempt: WSClientMessage = {
				type: 'subscribe',
				channel: 'report:123',
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(subscribeAttempt)),
			);

			await Promise.resolve();

			// Assert wildcard rejection behavior via channel broadcast
			const broadcastMsg = {
				channel: 'report:123' as Channel,
				event: 'new',
				data: {},
			};
			wsManager.broadcast(broadcastMsg);
			expect(mockSocket.send).not.toHaveBeenCalled();
		});

		it('should unsubscribe cleanly when receiving an unsubscribe event frame', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			// Establish a public subscription first
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(
					JSON.stringify({ type: 'subscribe', channel: 'server_state' }),
				),
			);
			await Promise.resolve();

			// Dispatch unsubscribe frame
			const unsubscribeFrame: WSClientMessage = {
				type: 'unsubscribe',
				channel: 'server_state',
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(unsubscribeFrame)),
			);

			await Promise.resolve();

			// Assert unsubscription behavior: the socket no longer reacts to channel activity
			mockSocket.send.mockClear();
			wsManager.broadcast({
				channel: 'server_state' as Channel,
				event: 'update',
				data: {},
			});
			expect(mockSocket.send).not.toHaveBeenCalled();
		});
	});

	describe('Data Providers Execution Contexts', () => {
		it('should pull, execute, and dispatch initial structural arrays from providers immediately upon subscribing', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			const mockDataPayload = [{ name: 'ox_lib', status: 'started' }];
			const providerMock = mock((_clientId, _channel) => mockDataPayload);

			wsManager.setInitialData('resourcelist', providerMock);

			const msg: WSClientMessage = {
				type: 'subscribe',
				channel: 'resourcelist',
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(msg)),
			);

			// Allow macro-task execution to wrap async execution pipelines
			await new Promise(process.nextTick);

			expect(providerMock).toHaveBeenCalledWith('client-id', 'resourcelist');
			expect(mockSocket.send).toHaveBeenCalledWith(
				JSON.stringify({
					channel: 'resourcelist',
					event: 'initial',
					data: mockDataPayload,
				}),
			);
		});

		it('should fall back onto dynamic wildcard providers if an explicit map lookup is unavailable', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			const wildcardProviderMock = mock(() => 'wildcard-data-response');
			wsManager.setInitialData('report:*' as any, wildcardProviderMock);

			const msg: WSClientMessage = { type: 'subscribe', channel: 'report:55' };
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(msg)),
			);

			await new Promise(process.nextTick);

			expect(wildcardProviderMock).toHaveBeenCalledWith(
				'client-id',
				'report:55',
			);
			expect(mockSocket.send).toHaveBeenCalledWith(
				JSON.stringify({
					channel: 'report:55',
					event: 'initial',
					data: 'wildcard-data-response',
				}),
			);
		});

		it('should trap errors occurring inside a data provider safely without crashing the event loops', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			wsManager.setInitialData('server_state', () => {
				throw new Error('Database layer dropped link handle');
			});

			const msg: WSClientMessage = {
				type: 'subscribe',
				channel: 'server_state',
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(msg)),
			);

			await new Promise(process.nextTick);

			expect(mockSocket.send).not.toHaveBeenCalled();
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				'[ws] Failed to send initial data for channel server_state:',
				expect.any(Error),
			);
		});
	});

	describe('Outbound Communication Framework (send / broadcast)', () => {
		it('should transmit messages to explicit targeting instances when socket states are active (readyState 1)', () => {
			const mockSocket = createMockSocket(1); // OPEN
			wsManager.add('client-target', mockSocket as any, {} as any);

			const messagePacket = {
				channel: 'console' as Channel,
				event: 'line',
				data: 'Execution log string',
			};
			wsManager.send('client-target', messagePacket);

			expect(mockSocket.send).toHaveBeenCalledWith(
				JSON.stringify(messagePacket),
			);
		});

		it('should suppress transmission if target destinations are not in an active open state', () => {
			const mockSocket = createMockSocket(0); // CONNECTING state
			wsManager.add('client-target', mockSocket as any, {} as any);

			wsManager.send('client-target', {
				channel: 'console',
				event: 'line',
				data: 'Dropped line frame',
			});
			expect(mockSocket.send).not.toHaveBeenCalled();
		});

		it('should broadcast items solely to active matching channel connections', async () => {
			const socketA = createMockSocket(1);
			const socketB = createMockSocket(1);
			const socketC = createMockSocket(1); // Active initially, modified later

			wsManager.add('id-a', socketA as any, {} as any);
			wsManager.add('id-b', socketB as any, {} as any);
			wsManager.add('id-c', socketC as any, {} as any);

			// Configure targets behaviorally via formal inbound subscription requests
			socketA.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify({ type: 'subscribe', channel: 'perf' })),
			);
			socketB.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify({ type: 'subscribe', channel: 'console' })),
			);
			socketC.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify({ type: 'subscribe', channel: 'perf' })),
			);

			await Promise.resolve();

			// Mutate socketC into a closing state post-subscription
			socketC.readyState = 2; // CLOSING

			const broadcastMsg = {
				channel: 'perf' as Channel,
				event: 'snapshot',
				data: { cpu: 12 },
			};
			wsManager.broadcast(broadcastMsg);

			expect(socketA.send).toHaveBeenCalledWith(JSON.stringify(broadcastMsg));
			expect(socketB.send).not.toHaveBeenCalled(); // Skipped due to channel mismatch
			expect(socketC.send).not.toHaveBeenCalled(); // Skipped due to dead readyState
		});
	});

	describe('Inbound Event Bus Bindings (on / onChannel)', () => {
		it('should trigger both specific handlers and wildcard listeners when an emit arrives', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			const exactHandler = mock(() => {});
			const channelWildcardHandler = mock(() => {});

			wsManager.on('console', 'command', exactHandler);
			wsManager.on('console', '*', channelWildcardHandler);

			const emitMessage: WSClientMessage = {
				type: 'emit',
				channel: 'console',
				event: 'command',
				data: { command: 'ensure oxmysql' },
			};

			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(emitMessage)),
			);

			await Promise.resolve();

			const expectedMatch = expect.objectContaining({
				id: 'client-id',
				socket: mockSocket,
			});
			expect(exactHandler).toHaveBeenCalledWith(expectedMatch, 'command', {
				command: 'ensure oxmysql',
			});
			expect(channelWildcardHandler).toHaveBeenCalledWith(
				expectedMatch,
				'command',
				{ command: 'ensure oxmysql' },
			);
		});

		it('should detach hooks immediately when invoking returned unbind closure handles', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			const executionHandler = mock(() => {});
			const detachClosure = wsManager.on(
				'console',
				'command',
				executionHandler,
			);

			// Sever event connection immediately
			detachClosure();

			const emitMessage: WSClientMessage = {
				type: 'emit',
				channel: 'console',
				event: 'command',
				data: { command: 'status' },
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(emitMessage)),
			);

			await Promise.resolve();
			expect(executionHandler).not.toHaveBeenCalled();
		});

		it('should route handlers via onChannel syntax structures perfectly as wildcard catchments', async () => {
			const mockSocket = createMockSocket();
			wsManager.add('client-id', mockSocket as any, {} as any);

			const globalChannelHandler = mock(() => {});
			wsManager.onChannel('playerlist', globalChannelHandler);

			const emitMessage: WSClientMessage = {
				type: 'emit',
				channel: 'playerlist',
				event: 'arbitrary_event',
				data: { id: 1 },
			};
			mockSocket.simulateClientEvent(
				'message',
				Buffer.from(JSON.stringify(emitMessage)),
			);

			await Promise.resolve();
			expect(globalChannelHandler).toHaveBeenCalledWith(
				expect.any(Object),
				'arbitrary_event',
				{ id: 1 },
			);
		});
	});
});
