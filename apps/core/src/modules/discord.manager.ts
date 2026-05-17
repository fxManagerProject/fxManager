import { Client, Events, GatewayIntentBits, type Guild } from 'discord.js';
import type { DiscordManagerConfig } from '@fxmanager/shared/types';

class DiscordManager {
	private client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
	});
	private connectionState: boolean = false;

	private botToken: string;
	private config: Omit<DiscordManagerConfig, 'token'>;

	private guild: Guild | null = null;

	constructor({ token, ...config }: DiscordManagerConfig) {
		this.botToken = token;
		this.config = config;
	}

	async connect() {
		try {
			const readyPromise = new Promise<void>((resolve, reject) => {
				this.client.once(Events.ClientReady, async (readyClient) => {
					try {
						console.log('Discord client authenticated.');

						this.guild = await readyClient.guilds.fetch(this.config.guildId);

						console.log(
							'Guild loaded:',
							this.guild
								? { name: this.guild.name, id: this.guild.id }
								: 'Not Found',
						);

						this.connectionState = true;
						resolve();
					} catch (fetchError) {
						reject(fetchError);
					}
				});
			});

			await this.client.login(this.botToken);

			await readyPromise;
		} catch (err) {
			this.connectionState = false;
			console.error(
				'[discord.manager] failed to connect:',
				(err as Error).message,
			);
			throw err;
		}
	}

	async disconnect() {
		try {
			await this.client.destroy();
			this.connectionState = false;
		} catch (err) {
			console.error(
				'[discord.manager] failed to destroy discord client API.',
				(err as Error).message,
			);
		}
	}

	isConnected() {
		return this.connectionState;
	}

	async checkWhitelist(discordId: string): Promise<boolean> {
		if (!this.guild) {
			throw new Error(`No guild was found for id: ${this.config.guildId}`);
		}

		if (/discord:[0-9]+/.test(discordId)) {
			discordId = discordId.slice(8);
		}

		try {
			const member = await this.guild.members.fetch(discordId);

			if (!member) return false;

			const { roles } = member;

			return roles.cache.hasAny(...this.config.whitelistedRoles);
		} catch {
			return false;
		}
	}
}

// NOTE / ToDo:
// config settings for the bot will be migrated to settings db

export const discordManager = new DiscordManager({
	token: process.env.DISCORD_BOT_TOKEN ?? '',
	guildId: process.env.DISCORD_GUILDID ?? '',
	whitelistedRoles: (process.env.DISCORD_ROLE_IDS ?? '')?.split(','),
});
