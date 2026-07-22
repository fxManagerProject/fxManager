import type { IOAuthProvider } from '../../types';
import { DiscordOAuthProvider } from './providers/discord';

class OAuthManager {
	private providers = new Map<string, IOAuthProvider>();

	registerProvider(provider: IOAuthProvider): this {
		this.providers.set(provider.name, provider);
		return this;
	}

	getProvider(name: string): IOAuthProvider {
		const provider = this.providers.get(name);
		if (!provider) {
			throw new Error(`OAuth provider '${name}' is not registered.`);
		}
		return provider;
	}

	hasProvider(name: string): boolean {
		return this.providers.has(name);
	}

	reload(): this {
		this.providers.forEach((provider) => {
			if (provider.initialize) {
				provider.initialize();
			}
		});
		return this;
	}
}

const oauthManager = new OAuthManager();
oauthManager.registerProvider(new DiscordOAuthProvider());

export { oauthManager };
