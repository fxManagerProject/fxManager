import { repo } from '@fxmanager/database';
import { ConfigManager } from '../config/manager';
import { IncidentRecorder } from './recorder';
import { redactIncidentText } from './redact';

export function incidentSecrets(): string[] {
	const { cookieSecret, resourceApiToken } =
		ConfigManager.getInstance().getSystemValues();
	return [
		cookieSecret,
		resourceApiToken,
		repo.settings.get('oauth.discordSecret') ?? '',
		repo.settings.get('whitelist.discordBotToken') ?? '',
		...Object.entries(process.env)
			.filter(([key]) =>
				/secret|token|password|license|api_?key|connection_string/i.test(key),
			)
			.map(([, value]) => value ?? ''),
	];
}

// Resolve lazily so module loading cannot access unmigrated tables.
export const incidentRecorder = new IncidentRecorder(
	{
		append: (events) => repo.incidents.append(events),
		prune: () => repo.incidents.prune(),
	},
	incidentSecrets,
);

export const redactIncidentInput = (text: string) =>
	redactIncidentText(text, incidentSecrets());
