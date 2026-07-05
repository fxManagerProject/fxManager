import { describe, expect, it } from 'bun:test';
import type { AnticheatConvarDef } from '@fxmanager/shared/types';
import {
	buildAnticheatArgs,
	isValidAnticheatValue,
	parseAnticheatOverrides,
	validateAnticheatOverrides,
} from './anticheat';

const booleanDef: AnticheatConvarDef = {
	name: 'sv_endpointPrivacy',
	setter: 'set',
	label: '',
	description: '',
	recommended: 'true',
	control: { kind: 'boolean' },
};

const enumDef: AnticheatConvarDef = {
	name: 'sv_requestParanoia',
	setter: 'set',
	label: '',
	description: '',
	recommended: '3',
	control: {
		kind: 'enum',
		options: [
			{ value: '0', label: '0' },
			{ value: '3', label: '3' },
		],
	},
};

const numberDef: AnticheatConvarDef = {
	name: 'sv_filterRequestControlSettleTimer',
	setter: 'set',
	label: '',
	description: '',
	recommended: '30000',
	control: { kind: 'number', min: 0 },
};

const setrBooleanDef: AnticheatConvarDef = {
	name: 'game_sanitizeRagdollEvents',
	setter: 'setr',
	label: '',
	description: '',
	recommended: 'true',
	control: { kind: 'boolean' },
};

const DEFS: AnticheatConvarDef[] = [booleanDef, enumDef, numberDef, setrBooleanDef];

describe('parseAnticheatOverrides', () => {
	it('returns an empty map for undefined, null, empty or malformed input', () => {
		expect(parseAnticheatOverrides(undefined)).toEqual({});
		expect(parseAnticheatOverrides(null)).toEqual({});
		expect(parseAnticheatOverrides('')).toEqual({});
		expect(parseAnticheatOverrides('not json')).toEqual({});
	});

	it('returns an empty map when the JSON is not an object', () => {
		expect(parseAnticheatOverrides('[]')).toEqual({});
		expect(parseAnticheatOverrides('5')).toEqual({});
	});

	it('keeps only string values', () => {
		expect(
			parseAnticheatOverrides(
				'{"sv_endpointPrivacy":"true","sv_requestParanoia":3,"x":null}',
			),
		).toEqual({ sv_endpointPrivacy: 'true' });
	});
});

describe('isValidAnticheatValue', () => {
	it('accepts only true/false for boolean convars', () => {
		expect(isValidAnticheatValue(booleanDef, 'true')).toBe(true);
		expect(isValidAnticheatValue(booleanDef, 'false')).toBe(true);
		expect(isValidAnticheatValue(booleanDef, '1')).toBe(false);
		expect(isValidAnticheatValue(booleanDef, 'yes')).toBe(false);
	});

	it('accepts only listed values for enum convars', () => {
		expect(isValidAnticheatValue(enumDef, '3')).toBe(true);
		expect(isValidAnticheatValue(enumDef, '2')).toBe(false);
	});

	it('accepts non-negative integers for number convars', () => {
		expect(isValidAnticheatValue(numberDef, '30000')).toBe(true);
		expect(isValidAnticheatValue(numberDef, '0')).toBe(true);
		expect(isValidAnticheatValue(numberDef, '-1')).toBe(false);
		expect(isValidAnticheatValue(numberDef, '1.5')).toBe(false);
		expect(isValidAnticheatValue(numberDef, 'abc')).toBe(false);
	});
});

describe('validateAnticheatOverrides', () => {
	it('drops unknown convars and warns', () => {
		const result = validateAnticheatOverrides({ not_a_convar: 'true' }, DEFS);
		expect(result.valid).toEqual({});
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('not_a_convar');
	});

	it('drops invalid values and warns', () => {
		const result = validateAnticheatOverrides(
			{ sv_requestParanoia: '9' },
			DEFS,
		);
		expect(result.valid).toEqual({});
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('sv_requestParanoia');
	});

	it('keeps valid convars', () => {
		const result = validateAnticheatOverrides(
			{ sv_endpointPrivacy: 'true', sv_requestParanoia: '3', bad: 'x' },
			DEFS,
		);
		expect(result.valid).toEqual({
			sv_endpointPrivacy: 'true',
			sv_requestParanoia: '3',
		});
		expect(result.warnings).toHaveLength(1);
	});
});

describe('buildAnticheatArgs', () => {
	it('returns no args for an empty map', () => {
		expect(buildAnticheatArgs({}, DEFS)).toEqual([]);
	});

	it('builds +set / +setr commands in definition order', () => {
		expect(
			buildAnticheatArgs(
				{ game_sanitizeRagdollEvents: 'true', sv_endpointPrivacy: 'true' },
				DEFS,
			),
		).toEqual([
			'+set',
			'sv_endpointPrivacy',
			'true',
			'+setr',
			'game_sanitizeRagdollEvents',
			'true',
		]);
	});
});
