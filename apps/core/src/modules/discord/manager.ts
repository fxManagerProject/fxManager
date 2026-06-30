import { Client, Events, GatewayIntentBits, type Guild } from 'discord.js';
import { repo } from '@fxmanager/database';
import type { DiscordManagerConfig } from '@fxmanager/shared/types';

class DiscordManager {
	private client = new Client({
		intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
	});
	private connectionState: boolean = false;

	private botToken = '';
	private config: Omit<DiscordManagerConfig, 'token'> = {
		guildId: '',
		whitelistedRoles: [],
	};

	private guild: Guild | null = null;

	private syncSettings() {
		this.botToken = repo.settings.get('whitelist.discordBotToken') ?? '';
		this.config.guildId = repo.settings.get('whitelist.discordGuildId') ?? '';
		this.config.whitelistedRoles =
			repo.settings.get('whitelist.discordRoleIds')?.split(',') ?? [];
	}

	async connect() {
		try {
			this.syncSettings();

			if (!this.botToken) {
				throw new Error('Discord bot token is not configured.');
			}

			if (!this.config.guildId) {
				throw new Error('Discord guild ID is not configured.');
			}

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
		} catch (err) {
			console.error(
				'[discord.manager] failed to destroy discord client API.',
				(err as Error).message,
			);
		} finally {
			this.connectionState = false;
		}
	}

	isConnected() {
		return this.connectionState;
	}

	private getRoles() {
		return this.config.whitelistedRoles;
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

			return roles.cache.hasAny(...this.getRoles());
		} catch {
			return false;
		}
	}
}

export const discordManager = new DiscordManager();
