import { afterAll, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { repo } from '@fxmanager/database';
import { UserPermissions } from '@fxmanager/shared/constants';
import { AceSyncManager, buildAceCommands } from './manager';

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
	const groupsListSpy = spyOn(repo.groups, 'list');
	const adminsListSpy = spyOn(repo.admins, 'listForAceSync');

	let aceSync: AceSyncManager;
	let sent: string[];
	let sender: { sendCommand: ReturnType<typeof mock> };

	beforeEach(() => {
		groupsListSpy.mockReset().mockReturnValue([
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
		adminsListSpy.mockReset().mockReturnValue([
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

	afterAll(() => {
		groupsListSpy.mockRestore();
		adminsListSpy.mockRestore();
	});

	it('apply() should push the built commands to the server', () => {
		aceSync.apply(sender);

		expect(sent).toEqual([
			'add_ace fxmanager.group.1 fxmanager.players.kick allow',
			'add_principal identifier.license:abc fxmanager.group.1',
		]);
	});

	it('resync() should remove previously applied entries before re-adding', () => {
		aceSync.apply(sender);
		sent.length = 0;

		aceSync.resync(sender);

		expect(sent).toEqual([
			'remove_ace fxmanager.group.1 fxmanager.players.kick allow',
			'remove_principal identifier.license:abc fxmanager.group.1',
			'add_ace fxmanager.group.1 fxmanager.players.kick allow',
			'add_principal identifier.license:abc fxmanager.group.1',
		]);
	});

	it('resync() without a prior apply should only add', () => {
		aceSync.resync(sender);

		expect(sent).toEqual([
			'add_ace fxmanager.group.1 fxmanager.players.kick allow',
			'add_principal identifier.license:abc fxmanager.group.1',
		]);
	});

	it('should clear tracked state when the server is unavailable', () => {
		aceSync.apply(sender);

		const offline = {
			sendCommand: mock(() => {
				throw new Error('Server stdin not available');
			}),
		};
		aceSync.resync(offline);

		// server restarted meanwhile — nothing stale should be removed
		sent.length = 0;
		aceSync.apply(sender);
		expect(sent.every((cmd) => cmd.startsWith('add_'))).toBe(true);
	});
});
