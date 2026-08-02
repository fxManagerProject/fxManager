import SettingRow from '../components/settingrow';
import { SETTINGS_DEFAULTS } from '@fxmanager/shared/constants';
import type { SettingsTabProps } from '@/types/settings';
import { Input } from '@fxmanager/ui/components/input';
import { Switch } from '@fxmanager/ui/components/switch';
import { ExternalLink } from 'lucide-react';

function blur(event: React.KeyboardEvent<HTMLInputElement>) {
	if (event.key !== 'Enter') return;
	event.currentTarget.blur();
}

export default function OAuthTab({
	data,
	onChange,
	disabled,
}: SettingsTabProps<'oauth'>) {
	const discordAuthEnabled =
		(data['oauth.discordEnabled'] ??
			SETTINGS_DEFAULTS['oauth.discordEnabled']) === 'true';
	const discordClientId =
		data['oauth.discordClientId'] ?? SETTINGS_DEFAULTS['oauth.discordClientId'];
	const discordSecret =
		data['oauth.discordSecret'] ?? SETTINGS_DEFAULTS['oauth.discordSecret'];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-4 rounded-lg border border-border/50 bg-muted/30 p-3">
				<div className="space-y-0.5">
					<span className="text-sm font-medium">
						Need help setting this up?
					</span>
					<p className="text-xs text-muted-foreground">
						Follow our step-by-step instructions to create your application and
						get your credentials.
					</p>
				</div>
				<a
					href="https://fxmanager.dev/docs/configuration/oauth"
					target="_blank"
					rel="noopener noreferrer"
					className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
				>
					View Guide
					<ExternalLink className="h-3.5 w-3.5" />
				</a>
			</div>

			<SettingRow label="Discord OAuth enabled">
				<Switch
					checked={discordAuthEnabled}
					disabled={disabled}
					onCheckedChange={(checked) =>
						onChange('oauth.discordEnabled', checked ? 'true' : 'false')
					}
				/>
			</SettingRow>

			<SettingRow label="Discord Client ID">
				<Input
					disabled={disabled}
					value={discordClientId}
					onChange={(event) => {
						const value = event.currentTarget.value;
						if (value === discordClientId) return;

						onChange('oauth.discordClientId', value);
					}}
				/>
			</SettingRow>

			<SettingRow label="Discord Client Secret">
				<Input
					className={discordSecret && 'blur-xs focus:blur-none'}
					defaultValue={discordSecret}
					disabled={disabled}
					placeholder={'XXXXXXXXXXXXXXXXXXX'}
					onBlur={(event) => {
						const value = event.currentTarget.value;
						if (value === discordSecret) return;

						onChange('oauth.discordSecret', value);
					}}
					onKeyDown={blur}
				/>
			</SettingRow>
		</div>
	);
}
