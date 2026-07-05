import { describe, expect, it } from 'bun:test';
import type { ConvarDef } from '@fxmanager/shared/types';
import {
	buildConvarArgs,
	isValidConvarValue,
	parseConvarOverrides,
	validateConvarOverrides,
} from './convar-defs';

const booleanDef: ConvarDef = {
	name: 'sv_endpointPrivacy',
	setter: 'set',
	label: '',
	description: '',
	recommended: 'true',
	control: { kind: 'boolean' },
};

const enumDef: ConvarDef = {
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

const numberDef: ConvarDef = {
	name: 'sv_filterRequestControlSettleTimer',
	setter: 'set',
	label: '',
	description: '',
	recommended: '30000',
	control: { kind: 'number', min: 0 },
};

const setrBooleanDef: ConvarDef = {
	name: 'game_sanitizeRagdollEvents',
	setter: 'setr',
	label: '',
	description: '',
	recommended: 'true',
	control: { kind: 'boolean' },
};

const textDef: ConvarDef = {
	name: 'sv_allowlistInstructions',
	setter: 'sets',
	label: '',
	description: '',
	control: { kind: 'text', maxLength: 512 },
};

const DEFS: ConvarDef[] = [booleanDef, enumDef, numberDef, setrBooleanDef];

describe('parseConvarOverrides', () => {
	it('returns an empty map for undefined, null, empty or malformed input', () => {
		expect(parseConvarOverrides(undefined)).toEqual({});
		expect(parseConvarOverrides(null)).toEqual({});
		expect(parseConvarOverrides('')).toEqual({});
		expect(parseConvarOverrides('not json')).toEqual({});
	});

	it('returns an empty map when the JSON is not an object', () => {
		expect(parseConvarOverrides('[]')).toEqual({});
		expect(parseConvarOverrides('5')).toEqual({});
	});

	it('keeps only string values', () => {
		expect(
			parseConvarOverrides(
				'{"sv_endpointPrivacy":"true","sv_requestParanoia":3,"x":null}',
			),
		).toEqual({ sv_endpointPrivacy: 'true' });
	});
});

describe('isValidConvarValue', () => {
	it('accepts only true/false for boolean convars', () => {
		expect(isValidConvarValue(booleanDef, 'true')).toBe(true);
		expect(isValidConvarValue(booleanDef, 'false')).toBe(true);
		expect(isValidConvarValue(booleanDef, '1')).toBe(false);
	});

	it('accepts only listed values for enum convars', () => {
		expect(isValidConvarValue(enumDef, '3')).toBe(true);
		expect(isValidConvarValue(enumDef, '2')).toBe(false);
	});

	it('accepts non-negative integers for number convars', () => {
		expect(isValidConvarValue(numberDef, '30000')).toBe(true);
		expect(isValidConvarValue(numberDef, '0')).toBe(true);
		expect(isValidConvarValue(numberDef, '-1')).toBe(false);
		expect(isValidConvarValue(numberDef, '1.5')).toBe(false);
	});

	it('accepts non-empty text within the max length', () => {
		expect(isValidConvarValue(textDef, 'join our discord')).toBe(true);
		expect(isValidConvarValue(textDef, '')).toBe(false);
		expect(isValidConvarValue(textDef, 'x'.repeat(513))).toBe(false);
	});
});

describe('validateConvarOverrides', () => {
	it('drops unknown convars and warns', () => {
		const result = validateConvarOverrides({ not_a_convar: 'true' }, DEFS);
		expect(result.valid).toEqual({});
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('not_a_convar');
	});

	it('drops invalid values and warns', () => {
		const result = validateConvarOverrides({ sv_requestParanoia: '9' }, DEFS);
		expect(result.valid).toEqual({});
		expect(result.warnings).toHaveLength(1);
	});

	it('keeps valid convars', () => {
		const result = validateConvarOverrides(
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

describe('buildConvarArgs', () => {
	it('returns no args for an empty map', () => {
		expect(buildConvarArgs({}, DEFS)).toEqual([]);
	});

	it('builds +set / +setr commands in definition order', () => {
		expect(
			buildConvarArgs(
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

	it('builds +sets commands for server-info convars', () => {
		expect(buildConvarArgs({ sv_allowlistInstructions: 'hello' }, [textDef])).toEqual([
			'+sets',
			'sv_allowlistInstructions',
			'hello',
		]);
	});

	it('escapes newlines in text values', () => {
		expect(
			buildConvarArgs({ sv_allowlistInstructions: 'line1\nline2' }, [textDef]),
		).toEqual(['+sets', 'sv_allowlistInstructions', 'line1\\nline2']);
	});
});
