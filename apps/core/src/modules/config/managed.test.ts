import { describe, expect, it } from 'bun:test';
import { detectManagedConvars } from './managed';

describe('detectManagedConvars', () => {
	it('flags onesync set via the set command', () => {
		expect(detectManagedConvars('set onesync on')).toEqual([
			{ line: 1, key: 'onesync' },
		]);
	});

	it('flags onesync set as a bare convar', () => {
		expect(detectManagedConvars('onesync legacy')).toEqual([
			{ line: 1, key: 'onesync' },
		]);
	});

	it('flags the setr and sets variants', () => {
		expect(detectManagedConvars('setr onesync on\nsets onesync on')).toEqual([
			{ line: 1, key: 'onesync' },
			{ line: 2, key: 'onesync' },
		]);
	});

	it('flags resource-api-token and api-port', () => {
		const hits = detectManagedConvars(
			'set resource-api-token abc123\nset api-port 3000',
		);
		expect(hits).toEqual([
			{ line: 1, key: 'resource-api-token' },
			{ line: 2, key: 'api-port' },
		]);
	});

	it('flags ensure/start of the fxManager resource case-insensitively', () => {
		expect(detectManagedConvars('ensure fxManager\nstart FXMANAGER')).toEqual([
			{ line: 1, key: 'fxmanager-resource' },
			{ line: 2, key: 'fxmanager-resource' },
		]);
	});

	it('ignores unrelated directives', () => {
		expect(
			detectManagedConvars('sv_hostname "My Server"\nensure chat'),
		).toEqual([]);
	});

	it('ignores commented-out lines', () => {
		expect(
			detectManagedConvars('# set onesync on\n// ensure fxManager'),
		).toEqual([]);
	});

	it('reports correct 1-based line numbers with blank lines', () => {
		const cfg = 'sv_maxclients 48\n\nset onesync on';
		expect(detectManagedConvars(cfg)).toEqual([{ line: 3, key: 'onesync' }]);
	});
});
