import type { ComponentType } from 'react';
import LoginPage from './login';
import DashboardPage from './dashboard';
import { Console } from './dashboard/console';

type RouteConfig = {
	path: string;
	element: ComponentType;
	auth?: boolean;
	layout?: boolean;
};

export const routes: RouteConfig[] = [
	{ path: '/login', element: LoginPage, auth: false },
	{ path: '/dashboard', element: DashboardPage },
	// { path: '/dashboard/players', element: OnlinePlayerList },
	// { path: '/players', element: Players },
	// { path: '/players/:playerId', element: PlayerView },
	{ path: '/console', element: Console },
	// { path: '/settings', element: Settings },
];
