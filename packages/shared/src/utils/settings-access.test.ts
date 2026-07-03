import { describe, expect, it } from 'bun:test';
import { UserPermissions } from '../constants';
import { canWriteSetting } from './settings-access';

const MASTER = UserPermissions.MASTER;
const SETTINGS = UserPermissions.SETTINGS_ACCESS;
const NONE = UserPermissions.NONE;

describe('canWriteSetting()', () => {
	it('lets a plain SETTINGS_ACCESS admin write ordinary keys', () => {
		expect(canWriteSetting('fxserver.onesync', SETTINGS)).toBe(true);
		expect(canWriteSetting('whitelist.mode', SETTINGS)).toBe(true);
		expect(canWriteSetting('restarts.enabled', SETTINGS)).toBe(true);
	});

	it('denies ordinary keys without SETTINGS_ACCESS', () => {
		expect(canWriteSetting('fxserver.onesync', NONE)).toBe(false);
	});

	it('denies host-path keys to a non-master SETTINGS_ACCESS admin', () => {
		expect(canWriteSetting('fxserver.executablePath', SETTINGS)).toBe(false);
		expect(canWriteSetting('fxserver.serverDataPath', SETTINGS)).toBe(false);
		expect(canWriteSetting('fxserver.serverConfigPath', SETTINGS)).toBe(false);
	});

	it('allows host-path keys only for a master admin', () => {
		expect(canWriteSetting('fxserver.executablePath', MASTER)).toBe(true);
		expect(canWriteSetting('fxserver.serverDataPath', MASTER)).toBe(true);
		expect(canWriteSetting('fxserver.serverConfigPath', MASTER)).toBe(true);
	});

	it('a master admin can also write ordinary keys', () => {
		expect(canWriteSetting('fxserver.onesync', MASTER)).toBe(true);
	});
});
