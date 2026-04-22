import type { ComponentType } from 'react';
import LoginPage from './login';
import DashboardPage from './dashboard';
import OnlinePlayerListPage from './dashboard/playerList';
import ConsolePage from './console';
import PlayersPage from './players';
import SettingsPage from './settings';
import PlayerView from './players/playerview';

type RouteConfig = {
	path: string;
	element: ComponentType;
	auth?: boolean;
	layout?: boolean;
};

export const routes: RouteConfig[] = [
	{ path: '/login', element: LoginPage, auth: false },
	{ path: '/dashboard', element: DashboardPage },
	{ path: '/dashboard/players', element: OnlinePlayerListPage },
	{ path: '/players', element: PlayersPage },
	{ path: '/players/:playerId', element: PlayerView },
	{ path: '/console', element: ConsolePage },
	{ path: '/settings', element: SettingsPage },
];
