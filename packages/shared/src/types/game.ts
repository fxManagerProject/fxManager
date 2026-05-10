import type { Player } from './players';

export type BanDataCard =
	| {
			reason: string;
			permanent: false;
			createdAt: Date;
			expiresAt: Date;
	  }
	| {
			reason: string;
			permanent: true;
			createdAt: Date;
	  };

export type DeferralCheckResponse =
	| {
			access: true;
	  }
	| {
			access: false;
			type: 'ban';
			ban: BanDataCard;
	  }
	| {
			access: false;
			type: 'error';
			reason: string;
	  };

export interface OnlinePlayer extends Player {
	serverId: number;
	ping?: number;
	health: number;
}

/** struct: key: serverid - value: [health, ping] */
export type PlayerUpdatePackage = Record<string, [number, number]>;

export interface ResourceData {
	name: string;
	version: string | null;
	author: string | null;
	description: string | null;
	repository: string | null;
	path: string;
	status: 'started' | 'stopped';
}

export interface ResourceInitialData {
	status: boolean | 'errored';
	resourcelist: ResourceData[];
}
