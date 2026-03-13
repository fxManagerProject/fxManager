import type { DeferralCheckResponse, PlayerIdentifiers } from '@fxmanager/types';
import { DeferralsDeferObj, DeferralsKickFunc } from '@common/types';
import { QueryManager } from '../utils/query';

on(
  'playerConnecting',
  async (playerName: string, setKickReason: DeferralsKickFunc, deferrals: DeferralsDeferObj) => {
    const src = source;
    const identifiers = {
      license: GetPlayerIdentifierByType(`${src}`, 'license'),
      steam: GetPlayerIdentifierByType(`${src}`, 'steam'),
      discord: GetPlayerIdentifierByType(`${src}`, 'discord'),
      fivem: GetPlayerIdentifierByType(`${src}`, 'stefivemam'),
    } satisfies PlayerIdentifiers;

    const apiChecks = await QueryManager<DeferralCheckResponse>({
      endpoint: '/api/players/deferrals',
      method: 'POST',
      body: { identifiers },
    });

    if (apiChecks.access) return deferrals.done();

    switch (apiChecks.type) {
      case 'ban':
        const ban = apiChecks.ban;
        const createdStr = new Date(ban.createdAt).toLocaleDateString();

        const expiryStr = ban.permanent
          ? '<span style="color: #ff4d4d; font-weight: bold;">Permanent</span>'
          : new Date(ban.expiresAt).toLocaleString();

        deferrals.done(
          `<div style="font-family: 'Segoe UI', sans-serif; padding: 20px; color: white; text-align: center;">
              <h1 style="color: #ff4d4d; margin-bottom: 10px;">Connection Rejected</h1>
              <p style="font-size: 1.2em;">You have been banned from this server.</p>
              <hr style="border: 0; border-top: 1px solid #444; margin: 20px 0;">
              
              <div style="text-align: left; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 5px;">
                <p><strong>Reason:</strong> ${ban.reason}</p>
                <p><strong>Banned on:</strong> ${createdStr}</p>
                <p><strong>Expires:</strong> ${expiryStr}</p>
              </div>

              <p style="margin-top: 20px; color: #888; font-size: 0.9em;">
                If you believe this is an error, please contact staff via Discord.
              </p>
            </div>`.trim(),
        );
        break;
      case 'error':
        deferrals.done(apiChecks.reason);
        break;
    }
  },
);

on('playerJoining', () => {
  const src = source;
  const name = GetPlayerName(`${src}`);
  const identifiers = {
    license: GetPlayerIdentifierByType(`${src}`, 'license'),
    steam: GetPlayerIdentifierByType(`${src}`, 'steam'),
    discord: GetPlayerIdentifierByType(`${src}`, 'discord'),
    fivem: GetPlayerIdentifierByType(`${src}`, 'stefivemam'),
  } satisfies PlayerIdentifiers;

  const body = {
    name,
    identifiers,
    serverId: src,
  } satisfies { name: string; identifiers: PlayerIdentifiers; serverId: number };

  QueryManager({
    endpoint: '/api/players/join',
    method: 'POST',
    body,
  });
});

on('playerDropped', () => {
  QueryManager({
    endpoint: '/api/players/drop',
    method: 'POST',
    body: { serverId: source },
  });
});
