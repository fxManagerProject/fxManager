import { locale, type FlattenObjectKeys } from '@communityox/ox_lib';

type RawLocales = FlattenObjectKeys<typeof import('../../locales/en.json')>;

function Locale<T extends RawLocales>(str: T, ...args: unknown[]): string;
function Locale<T extends string>(str: T, ...args: unknown[]): string | unknown;
function Locale<T extends string>(str: T, ...args: unknown[]) {
	return locale(str, ...args);
}

export default Locale;
