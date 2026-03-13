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
      ban: BanDataCard;
    }
  | {
      access: false;
      reason: string;
    };

export interface OnlinePlayer extends Player {
  serverId: number;
  ping?: number;
  health: number;
}

export type GameEventPayload =
  | { event: 'player.join'; data: OnlinePlayer }
  | { event: 'player.drop'; data: { serverId: number } };
