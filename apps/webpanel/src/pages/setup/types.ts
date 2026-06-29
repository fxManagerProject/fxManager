import type { AdminGroup } from '@fxmanager/shared/types';

export interface SetupFormData {
	// Step 1: Account
	username: string;
	password: string;
	confirmPassword: string;
	// Step 2: Server
	serverSetupMethod: 'manual' | 'installer';
	fxserverPath: string;
	resourcePath: string;
	// Step 3: Groups
	adminGroups: AdminGroup[];
}

export type SetupSteps = 'account' | 'server' | 'permissions' | 'import';
