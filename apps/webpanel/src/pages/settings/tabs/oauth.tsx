import SettingRow from '../components/settingrow';
import { SETTINGS_DEFAULTS } from '@fxmanager/shared/constants';
import type { SettingsTabProps } from '@/types/settings';
import { Input } from '@fxmanager/ui/components/input';
import { Switch } from '@fxmanager/ui/components/switch';

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
