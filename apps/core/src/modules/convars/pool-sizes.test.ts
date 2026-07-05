import { describe, expect, it } from 'bun:test';
import {
	buildIncreasePoolSizeArgs,
	parsePoolSizes,
	validatePoolSizes,
} from './pool-sizes';

describe('parsePoolSizes', () => {
	it('returns an empty map for undefined, null and empty input', () => {
		expect(parsePoolSizes(undefined)).toEqual({});
		expect(parsePoolSizes(null)).toEqual({});
		expect(parsePoolSizes('')).toEqual({});
	});

	it('returns an empty map for malformed JSON', () => {
		expect(parsePoolSizes('not json')).toEqual({});
	});

	it('returns an empty map when the JSON is not an object', () => {
		expect(parsePoolSizes('[]')).toEqual({});
		expect(parsePoolSizes('5')).toEqual({});
		expect(parsePoolSizes('"TxdStore"')).toEqual({});
	});

	it('keeps positive integer increases', () => {
		expect(parsePoolSizes('{"TxdStore":6000,"CMoveObject":15}')).toEqual({
			TxdStore: 6000,
			CMoveObject: 15,
		});
	});

	it('drops non-positive, non-integer and non-numeric values', () => {
		expect(
			parsePoolSizes(
				'{"Zero":0,"Neg":-5,"Float":1.5,"Str":"x","Null":null,"Ok":6000}',
			),
		).toEqual({ Ok: 6000 });
	});
});

describe('validatePoolSizes', () => {
	const limits = { TxdStore: 50000, CMoveObject: 600 };

	it('keeps increases within the limit, including the exact max', () => {
		expect(validatePoolSizes({ TxdStore: 50000, CMoveObject: 15 }, limits)).toEqual(
			{
				valid: { TxdStore: 50000, CMoveObject: 15 },
				warnings: [],
			},
		);
	});

	it('drops pools that are not in the limits and warns', () => {
		const result = validatePoolSizes({ NotAPool: 10 }, limits);
		expect(result.valid).toEqual({});
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('NotAPool');
	});

	it('drops increases above the max and warns', () => {
		const result = validatePoolSizes({ TxdStore: 99999 }, limits);
		expect(result.valid).toEqual({});
		expect(result.warnings).toHaveLength(1);
		expect(result.warnings[0]).toContain('TxdStore');
		expect(result.warnings[0]).toContain('50000');
	});

	it('keeps valid pools while dropping invalid ones', () => {
		const result = validatePoolSizes(
			{ TxdStore: 6000, NotAPool: 5, CMoveObject: 9000 },
			limits,
		);
		expect(result.valid).toEqual({ TxdStore: 6000 });
		expect(result.warnings).toHaveLength(2);
	});
});

describe('buildIncreasePoolSizeArgs', () => {
	it('returns no args for an empty map', () => {
		expect(buildIncreasePoolSizeArgs({})).toEqual([]);
	});

	it('builds one +increase_pool_size command per pool', () => {
		expect(
			buildIncreasePoolSizeArgs({ TxdStore: 6000, CMoveObject: 15 }),
		).toEqual([
			'+increase_pool_size',
			'TxdStore',
			'6000',
			'+increase_pool_size',
			'CMoveObject',
			'15',
		]);
	});
});
