export type ConvarGameType = 'fivem' | 'redm';

/** Map of pool name to the maximum allowed size increase, fetched live from cfx.re. */
export type PoolSizeLimits = Record<string, number>;

/** Map of pool name to the size increase the user configured. */
export type PoolSizeOverrides = Record<string, number>;

export interface ConvarPoolConfig {
	gameType: ConvarGameType;
	poolSizes: PoolSizeOverrides;
}

export type ConvarSetter = 'set' | 'setr' | 'sets';

export type ConvarControl =
	| { kind: 'boolean' }
	| { kind: 'enum'; options: { value: string; label: string }[] }
	| { kind: 'number'; min: number; max?: number; unit?: string }
	| {
			kind: 'text';
			maxLength?: number;
			multiline?: boolean;
			placeholder?: string;
	  };

export interface ConvarDef {
	name: string;
	setter: ConvarSetter;
	label: string;
	description: string;
	note?: string;
	recommended?: string;
	control: ConvarControl;
}

/** Map of convar name to the string value the user configured. */
export type ConvarOverrides = Record<string, string>;
