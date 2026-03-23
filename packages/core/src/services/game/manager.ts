import { repo } from '@fxmanager/database';
import type {
  ApiResponse,
  BanDataCard,
  DeferralCheckResponse,
  GameEventPayload,
  IGameManager,
  IProcessManager,
  OnlinePlayer,
  PlayerIdentifiers,
} from '@fxmanager/types';
import { loadConfig } from '../../config';

export class GameManager implements IGameManager {
  private pm: IProcessManager;
  private playerlist: OnlinePlayer[] = [];
  private apiToken: string;

  constructor(pm: IProcessManager) {
    this.pm = pm;

    const { resourceApiToken } = loadConfig();
    this.apiToken = resourceApiToken;
  }

  // region player handling
  getPlayerList() {
    return this.playerlist;
  }

  getPlayer(id: number) {
    return this.playerlist.find((p) => p.id === id);
  }

  playerDeferralChecks(identifiers: PlayerIdentifiers): DeferralCheckResponse {
    const ban = repo.players.checkBanned(identifiers);

    if (ban) {
      const isPerm = ban.expiresAt === null;

      let data: BanDataCard;

      if (isPerm)
        data = {
          permanent: true,
          reason: ban.reason,
          createdAt: ban.createdAt,
        };
      else
        data = {
          permanent: false,
          reason: ban.reason,
          createdAt: ban.createdAt,
          expiresAt: ban.expiresAt!,
        };

      return {
        access: false,
        type: 'ban',
        ban: data,
      };
    }

    /* ToDo: Add whitelist checks */

    return { access: true };
  }

  async playerJoin({
    name,
    identifiers,
    serverId,
  }: { name: string; identifiers: PlayerIdentifiers; serverId: number }) {
    const player = await repo.players.upsert(name, identifiers);

    const playerPayload = {
      serverId,
      health: -1,
      ...player,
    } satisfies OnlinePlayer;

    console.log('Player', name, serverId, 'has joined');

    this.playerlist.push(playerPayload);
    this.pm.handleGameEvent({
      event: 'player.join',
      data: playerPayload,
    });
  }

  async playerDrop(serverId: number) {
    const index = this.playerlist.findIndex((p) => p.serverId === serverId);

    if (index === -1) {
      console.warn(`[core - game] A player (${serverId}) disconnected but wasn't tracked!`);
      return;
    }

    const [player] = this.playerlist.splice(index, 1);
    const sessionDuration = Date.now() - player.lastSeen.getTime();
    const newPlaytime = player.playtime + sessionDuration;

    repo.players.updatePlaytime(player.id, newPlaytime);
    this.pm.handleGameEvent({
      event: 'player.drop',
      data: { serverId: player.serverId },
    });
  }

  // region act on players

  async dropPlayer(serverId: number, reason: string): Promise<ApiResponse> {
    try {
      const response = await fetch('http://localhost:30120/fxManager/drop', {
        method: 'POST',
        body: JSON.stringify({
          serverId,
          reason,
        }),
        headers: {
          Application: 'json/application',
          'x-resource-token': this.apiToken,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Server responded with ${response.status}: ${response.statusText}`,
        };
      }

      const result = (await response.json()) as ApiResponse;

      if (result.success) {
        return {
          success: true,
          data: null,
        };
      }

      return {
        success: false,
        error: result.error ?? 'Unable to fulfill drop request',
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  }

  // region private methods
  private async handlePanelEvent(payload: GameEventPayload) {}
}
