import { describe, expect, it } from 'bun:test';
import { parseFxServerBuild } from './fxserver-version';

describe('parseFxServerBuild', () => {
	it('extracts the build number from a Windows version string', () => {
		expect(parseFxServerBuild('FXServer-master SERVER v1.0.0.7290 win32')).toBe(
			'7290',
		);
	});

	it('extracts the build number from a Linux version string', () => {
		expect(parseFxServerBuild('FXServer-master v1.0.0.9956 linux')).toBe(
			'9956',
		);
	});

	it('extracts a recent multi-digit build number', () => {
		expect(
			parseFxServerBuild('FXServer-master SERVER v1.0.0.31725 win32'),
		).toBe('31725');
	});

	it('extracts the build from a feature-branch version string', () => {
		expect(
			parseFxServerBuild(
				'FXServer-feature/improve_player_dropped_event SERVER v1.0.0.20240707 win32',
			),
		).toBe('20240707');
	});

	it('returns null when the convar is the unknown fallback', () => {
		expect(parseFxServerBuild('unknown')).toBeNull();
	});

	it('returns null when no build number is present', () => {
		expect(
			parseFxServerBuild("FXServer-no-version (didn't run build tools?)"),
		).toBeNull();
	});

	it('returns null for an empty string', () => {
		expect(parseFxServerBuild('')).toBeNull();
	});
});
