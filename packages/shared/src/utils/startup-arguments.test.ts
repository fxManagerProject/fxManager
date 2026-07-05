import { describe, expect, it } from 'bun:test';
import { validateStartupArguments } from './startup-arguments';

describe('validateStartupArguments()', () => {
	it('should return true for valid arguments', () => {
		expect(validateStartupArguments('+svgui --trace-warnings')).toEqual({
			valid: true,
		});
		expect(validateStartupArguments('+exec somecfg.cfg')).toEqual({
			valid: true,
		});
	});

	it('should return the first restricted value for invalid arguments', () => {
		expect(
			validateStartupArguments('+exec somecfg.cfg +set onesync on'),
		).toEqual({ valid: false, argument: '+set onesync on' });
		expect(
			validateStartupArguments('+stop fxManager +set api-port 40120'),
		).toEqual({ valid: false, argument: '+stop fxManager' });
		expect(
			validateStartupArguments('--library-path /home/user/somefolder'),
		).toEqual({
			valid: false,
			argument: '--library-path /home/user/somefolder',
		});
	});
});
