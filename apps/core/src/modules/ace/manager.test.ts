import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { UserPermissions } from '@fxmanager/shared/constants';

const mockGroupsList = mock<() => unknown[]>(() => []);
const mockListForAceSync = mock<() => unknown[]>(() => []);

mock.module('@fxmanager/database', () => ({
	repo: {
		groups: { list: mockGroupsList },
		admins: { listForAceSync: mockListForAceSync },
	},
}));

const { AceSyncManager, buildAceCommands } = await import('./manager');
type AceSyncManagerInstance = InstanceType<typeof AceSyncManager>;

const warnSpy = spyOn(console, 'warn').mockImplementation(() => {});

afterAll(() => {
	warnSpy.mockRestore();
});

describe('buildAceCommands()', () => {
	it('should grant one ace per permission bit to the group principal', () => {
		const commands = buildAceCommands(
			[{ id: 3, permissions: UserPermissions.KICK | UserPermissions.BAN }],
			[],
		);

		expect(commands).toEqual([
			'add_ace fxmanager.group.3 fxmanager.players.kick allow',
			'add_ace fxmanager.group.3 fxmanager.players.ban allow',
		]);
	});

	it('should bind linked admins to their group principal', () => {
		const commands = buildAceCommands(
			[{ id: 3, permissions: UserPermissions.KICK }],
			[
				{
					id: 7,
					username: 'mod',
					permissions: 0,
					groupId: 3,
					license: 'license:abc123',
				},
			],
		);

		expect(commands).toContain(
			'add_principal identifier.license:abc123 fxmanager.group.3',
		);
	});

	it('should grant master admins the root ace via the master principal', () => {
		const commands = buildAceCommands(
			[],
			[
				{
					id: 1,
					username: 'owner',
					permissions: UserPermissions.MASTER,
					groupId: null,
					license: 'license:masterlic',
				},
			],
		);

		expect(commands).toEqual([
			'add_ace fxmanager.master fxmanager allow',
			'add_principal identifier.license:masterlic fxmanager.master',
		]);
	});

	it('should grant personal bitmask aces via a per-admin principal', () => {
		const commands = buildAceCommands(
			[],
			[
				{
					id: 9,
					username: 'custom',
					permissions: UserPermissions.WARN,
					groupId: null,
					license: 'license:cust01',
				},
			],
		);

		expect(commands).toEqual([
			'add_ace fxmanager.admin.9 fxmanager.players.warn allow',
			'add_principal identifier.license:cust01 fxmanager.admin.9',
		]);
	});

	it('should skip admins without a linked license', () => {
		const commands = buildAceCommands(
			[],
			[
				{
					id: 2,
					username: 'unlinked',
					permissions: UserPermissions.KICK,
					groupId: null,
					license: null,
				},
			],
		);

		expect(commands).toEqual([]);
	});

	it('should skip malformed licenses that could inject commands', () => {
		const commands = buildAceCommands(
			[],
			[
				{
					id: 4,
					username: 'evil',
					permissions: UserPermissions.KICK,
					groupId: null,
					license: 'license:abc; quit',
				},
			],
		);

		expect(commands).toEqual([]);
		expect(warnSpy).toHaveBeenCalled();
	});
});

describe('AceSyncManager', () => {
	let aceSync: AceSyncManagerInstance;
	let sent: string[];
	let sender: { sendCommand: ReturnType<typeof mock> };

	beforeEach(() => {
		mockGroupsList.mockReset().mockReturnValue([
			{
				id: 1,
				name: 'Mods',
				permissions: UserPermissions.KICK,
				colour: '#fff',
				icon: null,
				createdAt: new Date(),
				memberCount: 1,
			},
		]);
		mockListForAceSync.mockReset().mockReturnValue([
			{
				id: 5,
				username: 'mod',
				permissions: 0,
				groupId: 1,
				license: 'license:abc',
			},
		]);

		aceSync = new AceSyncManager();
		sent = [];
		sender = {
			sendCommand: mock((command: string) => {
				sent.push(command);
			}),
		};
	});

	it('apply() should push the built commands to the server', () => {
		aceSync.apply(sender);

		expect(sent).toEqual([
			'add_ace fxmanager.group.1 fxmanager.players.kick allow',
			'add_principal identifier.license:abc fxmanager.group.1',
		]);
	});

	it('resync() should send nothing when nothing changed', () => {
		aceSync.apply(sender);
		sent.length = 0;

		aceSync.resync(sender);

		expect(sent).toEqual([]);
	});

	it('resync() should move the principal when a linked admin changes group', () => {
		mockGroupsList.mockReturnValue([
			{
				id: 1,
				name: 'Mods',
				permissions: UserPermissions.KICK,
				colour: '#fff',
				icon: null,
				createdAt: new Date(),
				memberCount: 1,
			},
			{
				id: 2,
				name: 'Devs',
				permissions: UserPermissions.CONSOLE_VIEW,
				colour: '#fff',
				icon: null,
				createdAt: new Date(),
				memberCount: 0,
			},
		]);
		aceSync.apply(sender); // admin 5 linked to group 1 (has kick)
		sent.length = 0;

		mockListForAceSync.mockReturnValue([
			{ id: 5, username: 'mod', permissions: 0, groupId: 2, license: 'license:abc' },
		]);
		aceSync.resync(sender);

		expect(sent).toContain('add_principal identifier.license:abc fxmanager.group.2');
		expect(sent).toContain(
			'remove_principal identifier.license:abc fxmanager.group.1',
		);
	});

	it('resync() should remove the principal when a linked admin is deleted', () => {
		aceSync.apply(sender);
		sent.length = 0;

		mockListForAceSync.mockReturnValue([]);
		aceSync.resync(sender);

		expect(sent).toContain(
			'remove_principal identifier.license:abc fxmanager.group.1',
		);
	});

	it('resync() should only send the delta, additions first', () => {
		aceSync.apply(sender);
		sent.length = 0;

		mockGroupsList.mockReturnValue([
			{
				id: 1,
				name: 'Mods',
				permissions: UserPermissions.BAN,
				colour: '#fff',
				icon: null,
				createdAt: new Date(),
				memberCount: 1,
			},
		]);

		aceSync.resync(sender);

		expect(sent).toEqual([
			'add_ace fxmanager.group.1 fxmanager.players.ban allow',
			'remove_ace fxmanager.group.1 fxmanager.players.kick allow',
		]);
	});

	it('resync() without a prior apply should only add', () => {
		aceSync.resync(sender);

		expect(sent).toEqual([
			'add_ace fxmanager.group.1 fxmanager.players.kick allow',
			'add_principal identifier.license:abc fxmanager.group.1',
		]);
	});

	it('refresh() should no-op before apply and delta-sync after', () => {
		aceSync.refresh();
		expect(sent).toEqual([]);

		aceSync.apply(sender);
		sent.length = 0;

		mockListForAceSync.mockReturnValue([
			{
				id: 5,
				username: 'mod',
				permissions: 0,
				groupId: 1,
				license: 'license:abc',
			},
			{
				id: 6,
				username: 'fresh',
				permissions: 0,
				groupId: 1,
				license: 'license:def',
			},
		]);

		aceSync.refresh();

		expect(sent).toEqual([
			'add_principal identifier.license:def fxmanager.group.1',
		]);
	});

	it('should clear tracked state when the server is unavailable', () => {
		aceSync.apply(sender);

		mockGroupsList.mockReturnValue([
			{
				id: 1,
				name: 'Mods',
				permissions: UserPermissions.BAN,
				colour: '#fff',
				icon: null,
				createdAt: new Date(),
				memberCount: 1,
			},
		]);
		const offline = {
			sendCommand: mock(() => {
				throw new Error('Server stdin not available');
			}),
		};
		aceSync.resync(offline);

		// server restarted meanwhile — nothing stale should be removed
		sent.length = 0;
		aceSync.apply(sender);
		expect(sent.length).toBeGreaterThan(0);
		expect(sent.every((cmd) => cmd.startsWith('add_'))).toBe(true);
	});
});
