import { UserPermissions } from '@fxmanager/shared/constants';
import {
	Terminal,
	Boxes,
	Users,
	FileBarChart,
	type LucideIcon,
	Activity,
} from 'lucide-react';

/* Basically all mock stuff, just placeholder */

export type SectionKey =
	| 'dashboard'
	| 'console'
	| 'resources'
	| 'players'
	| 'reports';

export interface SectionConfig {
	key: SectionKey;
	label: string;
	icon: LucideIcon;
	/** bitfield value */
	permission: number;
}

// Single source of truth for what exists in the main panel and who can open it.
// Adding a new section = adding a row here + a view component, nothing else.
export const SECTIONS: SectionConfig[] = [
	{
		key: 'dashboard',
		label: 'Dashboard',
		icon: Activity,
		permission: UserPermissions.PLAYER_MONITORING,
	},
	{
		key: 'players',
		label: 'Players',
		icon: Users,
		permission: UserPermissions.PLAYER_MONITORING,
	},
	{
		key: 'console',
		label: 'Console',
		icon: Terminal,
		permission: UserPermissions.CONSOLE_VIEW,
	},
	{
		key: 'resources',
		label: 'Resources',
		icon: Boxes,
		permission: UserPermissions.RESOURCE_LIST,
	},
	{
		key: 'reports',
		label: 'Reports',
		icon: FileBarChart,
		permission: UserPermissions.NONE,
	},
];
