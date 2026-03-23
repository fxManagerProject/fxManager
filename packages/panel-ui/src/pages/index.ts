import type { ComponentType } from 'react';
import LoginPage from './public/LoginPage';
import Dashboard from './dashboard/Main';
import Players from './players/Main';
import PlayerView from './players/PlayerView';
import Console from './console/Main';
import Settings from './settings/Settings';
import OnlinePlayerList from './dashboard/PlayerList';

type RouteConfig = {
  path: string;
  element: ComponentType;
  auth?: boolean;
  layout?: boolean;
};

export const routes: RouteConfig[] = [
  { path: '/login', element: LoginPage, auth: false },
  { path: '/dashboard', element: Dashboard },
  { path: '/dashboard/players', element: OnlinePlayerList },
  { path: '/players', element: Players },
  { path: '/players/:playerId', element: PlayerView },
  { path: '/console', element: Console },
  { path: '/settings', element: Settings },
];
