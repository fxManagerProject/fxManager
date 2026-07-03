import type { DeferralsDeferObj, DeferralsKickFunc } from '@common/types';
import type {
	DeferralCheckResponse,
	PlayerIdentifiers,
} from '@fxmanager/shared/types';
import { QueryManager } from '../utils/query';
import { renderBanCard } from '../utils/ban-card';
import { playerManager } from '../monitoring';

function getIdentifiers(src: string): Partial<PlayerIdentifiers> {
	const raw: PlayerIdentifiers = {
		license: GetPlayerIdentifierByType(src, 'license'),
		steam: GetPlayerIdentifierByType(src, 'steam'),
		discord: GetPlayerIdentifierByType(src, 'discord'),
		fivem: GetPlayerIdentifierByType(src, 'fivem'),
	};

	// Create a new object containing only truthy values
	return Object.fromEntries(
		Object.entries(raw).filter(([_, value]) => value != null && value !== ''),
	);
}

on(
	'playerConnecting',
	async (
		playerName: string,
		_setKickReason: DeferralsKickFunc,
		deferrals: DeferralsDeferObj,
	) => {
		deferrals.defer();

		const src = source;
		const identifiers = getIdentifiers(`${src}`);

		setTimeout(() => {
			deferrals.update('Checking you access');

			setTimeout(async () => {
				// Sanity check
				if (typeof identifiers.license !== 'string')
					return deferrals.done('No license found.');

				let apiChecks: DeferralCheckResponse = { access: true };
				try {
					apiChecks = await QueryManager<DeferralCheckResponse>({
						endpoint: '/players/deferrals',
						method: 'POST',
						body: { identifiers },
					});
				} catch (err) {
					const msg = (err as Error).message;

					console.error(
						`[API Error] Failed to connection join for ${playerName} (${src}):`,
						msg,
					);

					apiChecks = {
						access: false,
						type: 'error',
						reason: `Internal Error:\n${msg}`,
					};
				}

				if (apiChecks.access) return deferrals.done();

				switch (apiChecks.type) {
					case 'ban': {
						deferrals.done(renderBanCard(apiChecks.ban));
						break;
					}
					case 'error':
						deferrals.done(apiChecks.reason);
						break;
				}
			}, 0);
		});
	},
);

on('playerJoining', async () => {
	const src = source;
	const name = GetPlayerName(`${src}`);
	// guarateed to have a license
	const identifiers = getIdentifiers(`${src}`) as PlayerIdentifiers;

	// Sanity check
	if (typeof identifiers.license !== 'string')
		return DropPlayer(`${src}`, 'No license found.');

	playerManager.addPlayer(src);

	const body = {
		name,
		identifiers,
		serverId: src,
	} satisfies {
		name: string;
		identifiers: PlayerIdentifiers;
		serverId: number;
	};

	try {
		await QueryManager<{ ack: true }>({
			endpoint: '/players/join',
			method: 'POST',
			body,
		});
	} catch (err) {
		console.error(
			`[API Error] Failed to process join for ${name} (${src}):`,
			(err as Error).message,
		);
	}
});

on(
	'playerDropped',
	async (reason: string, resourceName: string, category: number) => {
		const src = source;

		playerManager.removePlayer(src);

		try {
			await QueryManager<{ ack: true }>({
				endpoint: '/players/drop',
				method: 'POST',
				body: { serverId: src, reason, resourceName, category },
			});
		} catch (err) {
			console.error(
				`[API Error] Failed to process drop for ID ${src}:`,
				(err as Error).message,
			);
		}
	},
);
