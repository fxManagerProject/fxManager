import type { LucideIcon } from 'lucide-react';

export interface NavCategory {
	title: string;
	items: NavItem[];
}

export interface NavItem {
	title: string;
	url: string;
	icon?: LucideIcon;
	permission?: number;
}
