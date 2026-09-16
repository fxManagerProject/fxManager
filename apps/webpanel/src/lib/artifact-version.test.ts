import { describe, expect, it } from 'bun:test';
import { compareArtifactBuilds } from './artifact-version';

describe('compareArtifactBuilds', () => {
	it('flags a running build older than the recommended one', () => {
		expect(compareArtifactBuilds('13068', '31725')).toBe('outdated');
	});

	it('reports a match when both builds are identical', () => {
		expect(compareArtifactBuilds('31725', '31725')).toBe('current');
	});

	it('reports ahead when running a build newer than recommended', () => {
		expect(compareArtifactBuilds('31726', '31725')).toBe('ahead');
	});

	it('compares numerically rather than lexicographically', () => {
		expect(compareArtifactBuilds('9999', '13068')).toBe('outdated');
		expect(compareArtifactBuilds('13068', '9999')).toBe('ahead');
	});

	it('returns unknown while either side is still missing', () => {
		expect(compareArtifactBuilds(null, '31725')).toBe('unknown');
		expect(compareArtifactBuilds('31725', null)).toBe('unknown');
		expect(compareArtifactBuilds(null, null)).toBe('unknown');
		expect(compareArtifactBuilds(undefined, undefined)).toBe('unknown');
	});

	it('returns unknown for values that are not build numbers', () => {
		expect(compareArtifactBuilds('unknown', '31725')).toBe('unknown');
		expect(compareArtifactBuilds('31725', 'v1.0.0.31725')).toBe('unknown');
		expect(compareArtifactBuilds('b31725', '31725')).toBe('unknown');
		expect(compareArtifactBuilds('', '31725')).toBe('unknown');
		expect(compareArtifactBuilds('123', '31725')).toBe('unknown');
	});
});
