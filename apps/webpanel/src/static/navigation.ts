import { LayoutDashboard, Terminal, Users, Settings } from 'lucide-react';
import type { NavItem } from '@/types/sidebar';

export const NAV: NavItem[] = [
  { url: '/dashboard', icon: LayoutDashboard, title: 'Dashboard', items: [
    { url: '/dashboard/', title: 'Server Controls' },
    { url: '/dashboard/players', title: 'Player list' },
  ] },
  { url: '/console', icon: Terminal, title: 'Console' },
  { url: '/players', icon: Users, title: 'Players' },
  { url: '/settings', icon: Settings, title: 'Settings' },
];
