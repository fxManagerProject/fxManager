/** biome-ignore-all lint/suspicious/noExplicitAny lint/complexity/noBannedTypes: explicit any allows testing hidden state properties & mocking frames */
import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	mock,
	spyOn,
} from 'bun:test';

// Import the real modules so we can spy on their instances/classes
import { wsManager } from '../ws/manager';
import { ConfigManager } from '../config/manager';

const mockGetSystemValues = mock(() => ({
	resourceApiToken: 'mock-secure-api-token',
}));

// Use spyOn to temporarily intercept methods without wiping out the entire module layout
const broadcastSpy = spyOn(wsManager, 'broadcast').mockImplementation(() => {});
const getInstanceSpy = spyOn(ConfigManager, 'getInstance').mockReturnValue({
	getSystemValues: mockGetSystemValues,
} as any);

mock.module('../../common/fxserver-endpoint', () => ({
	getServerNetEndpoint: async () => '127.0.0.1:30120',
}));

// Import the system under test (SUT) after establishing the spies
import { resourceManager } from './manager';

describe('ResourceManager', () => {
	let originalFetch: typeof globalThis.fetch;

	beforeEach(() => {
		// Reset all mock tracking calls
		broadcastSpy.mockClear();
		mockGetSystemValues.mockClear();

		// Preserve and isolate global fetch environment
		originalFetch = globalThis.fetch;

		// Explicitly assign the mock config onto the instance
		// to destroy any cross-file module caching leaks
		(resourceManager as any).config = {
			getSystemValues: mockGetSystemValues,
		};

		// Reset singleton internal state between tests to avoid test bleeding
		(resourceManager as any).available = false;
		(resourceManager as any).resourcelist = [];
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	// CRITICAL FIX: Clean up the shared global process state after this suite completes
	afterAll(() => {
		broadcastSpy.mockRestore();
		getInstanceSpy.mockRestore();
	});

	describe('Initial State & Getters', () => {
		it('should initialize with an empty resource array and available set to false', () => {
			const state = resourceManager.getResourceList();
			expect(state).toEqual({
				status: false,
				resourcelist: [],
			});
		});
	});

	describe('loadResources()', () => {
		it('should populate resources and broadcast updates on a successful API response', async () => {
			const mockResources = [
				{ name: 'spawnmanager', status: 'started' },
				{ name: 'oxmysql', status: 'started' },
			];

			globalThis.fetch = mock(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							success: true,
							data: mockResources,
						}),
						{ status: 200 },
					),
				),
			) as any;

			await resourceManager.loadResources();

			expect(mockGetSystemValues).toHaveBeenCalled();
			expect(resourceManager.getResourceList().status).toBe(true);
			expect(resourceManager.getResourceList().resourcelist).toEqual(
				mockResources as any,
			);

			expect(broadcastSpy).toHaveBeenCalledWith({
				channel: 'resourcelist',
				event: 'refresh',
				data: {
					status: true,
					resourcelist: mockResources as any,
				},
			});
		});

		it('should set status to errored if the HTTP response status code is not ok (e.g., 500)', async () => {
			globalThis.fetch = mock(() =>
				Promise.resolve(new Response('Internal Server Error', { status: 500 })),
			) as any;

			await resourceManager.loadResources();

			expect(resourceManager.getResourceList().status).toBe('errored');
			expect(resourceManager.getResourceList().resourcelist).toEqual([]);
			expect(broadcastSpy).not.toHaveBeenCalled();
		});

		it('should set status to errored if the API wrapper success flag returns false', async () => {
			globalThis.fetch = mock(() =>
				Promise.resolve(
					new Response(
						JSON.stringify({
							success: false,
							error: 'Invalid API Handshake Sequence',
						}),
						{ status: 200 },
					),
				),
			) as any;

			await resourceManager.loadResources();

			expect(resourceManager.getResourceList().status).toBe('errored');
			expect(broadcastSpy).not.toHaveBeenCalled();
		});

		it('should handle unhandled network rejections gracefully and catch execution blocks safely', async () => {
			globalThis.fetch = mock(() =>
				Promise.reject(new Error('Connection Refused / Timeout')),
			) as any;

			await resourceManager.loadResources();

			expect(resourceManager.getResourceList().status).toBe('errored');
			expect(broadcastSpy).not.toHaveBeenCalled();
		});
	});

	describe('stoppingServer()', () => {
		it('should mark all loaded internal resources as stopped and set availability flags off', () => {
			(resourceManager as any).resourcelist = [
				{ name: 'ox_lib', status: 'started' },
				{ name: 'ox_core', status: 'started' },
				{ name: 'ox_inventory', status: 'starting' },
			];
			(resourceManager as any).available = true;

			resourceManager.stoppingServer();

			const state = resourceManager.getResourceList();
			expect(state.status).toBe(false);

			expect(state.resourcelist).toEqual([
				{ name: 'ox_lib', status: 'stopped' },
				{ name: 'ox_core', status: 'stopped' },
				{ name: 'ox_inventory', status: 'stopped' },
			] as any);

			expect(broadcastSpy).toHaveBeenCalledWith({
				channel: 'resourcelist',
				event: 'refresh',
				data: {
					status: false,
					resourcelist: state.resourcelist,
				},
			});
		});
	});

	describe('handleResourceUpdate()', () => {
		it('should cleanly overwrite list array contexts and broadcast refresh messages on refresh instructions', () => {
			const refreshedData = [{ name: 'mapmanager', status: 'started' }];
			(resourceManager as any).available = true;

			resourceManager.handleResourceUpdate({
				event: 'refresh',
				data: refreshedData as any,
			});

			expect(resourceManager.getResourceList().resourcelist).toEqual(
				refreshedData as any,
			);
			expect(broadcastSpy).toHaveBeenCalledWith({
				channel: 'resourcelist',
				event: 'refresh',
				data: {
					status: true,
					resourcelist: refreshedData as any,
				},
			});
		});

		it('should accurately overwrite items if they are found at index paths greater than zero', () => {
			const itemA = { name: 'resource-a', status: 'started' };
			const itemB = { name: 'resource-b', status: 'stopped' };
			(resourceManager as any).resourcelist = [itemA, itemB];

			const updatedItemB = { name: 'resource-b', status: 'started' };

			resourceManager.handleResourceUpdate({
				event: 'update',
				data: updatedItemB as any,
			});

			const internalList = (resourceManager as any).resourcelist;
			expect(internalList.length).toBe(2);
			expect(internalList[1]).toEqual(updatedItemB);

			expect(broadcastSpy).toHaveBeenCalledWith({
				channel: 'resourcelist',
				event: 'update',
				data: updatedItemB as any,
			});
		});
	});
});
