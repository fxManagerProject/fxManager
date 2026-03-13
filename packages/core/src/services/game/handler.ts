import { repo } from '@fxmanager/database';
import {
  BanDataCard,
  DeferralCheckResponse,
  OnlinePlayer,
  PlayerIdentifiers,
} from '@fxmanager/types';

export class GameHandler {
  private playerlist: OnlinePlayer[] = [];

  constructor() {}

  // region player handling
  getPlayerList() {
    return this.playerlist;
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

    this.playerlist.push({
      serverId,
      health: -1,
      ...player,
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
  }
}
