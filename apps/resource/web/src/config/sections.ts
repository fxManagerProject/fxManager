import {
	Terminal,
	Boxes,
	Users,
	FileBarChart,
	type LucideIcon,
} from 'lucide-react';
import type { FxPermission } from '~/lib/access';

/* Basically all mock stuff, just placeholder */

export type SectionKey = 'console' | 'resources' | 'players' | 'reports';

export interface SectionConfig {
	key: SectionKey;
	label: string;
	icon: LucideIcon;
	requires: FxPermission;
}

// Single source of truth for what exists in the main panel and who can open it.
// Adding a new section = adding a row here + a view component, nothing else.
export const SECTIONS: SectionConfig[] = [
	{ key: 'players', label: 'Players', icon: Users, requires: 'moderator' },
	{ key: 'console', label: 'Console', icon: Terminal, requires: 'admin' },
	{ key: 'resources', label: 'Resources', icon: Boxes, requires: 'admin' },
	{
		key: 'reports',
		label: 'Reports',
		icon: FileBarChart,
		requires: 'superadmin',
	},
];
