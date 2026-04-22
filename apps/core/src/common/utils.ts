import { repo } from '@fxmanager/database';

export const isProduction = process.env.NODE_ENV === 'production';
export const COOKIE_NAME = 'fxm_session';

export function isFxManagerSetup() {
	return repo.auth.countUsers() > 0;
}
