import SettingRow from '../components/settingrow';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import { SETTINGS_DEFAULTS } from '@fxmanager/shared/constants';
import type { SettingsTabProps } from '@/types/settings';
import { Separator } from '@fxmanager/ui/components/separator';
import { Input } from '@fxmanager/ui/components/input';

export default function FXServerTab({
	data,
	onChange,
	disabled,
}: SettingsTabProps<'fxserver'>) {
	const onesync =
		data['fxserver.onesync'] ?? SETTINGS_DEFAULTS['fxserver.onesync'];
	const serverDataPath =
		data['fxserver.serverDataPath'] ??
		SETTINGS_DEFAULTS['fxserver.serverDataPath'];
	const executablePath =
		data['fxserver.executablePath'] ??
		SETTINGS_DEFAULTS['fxserver.executablePath'];
	const serverConfigPath =
		data['fxserver.serverConfigPath'] ??
		SETTINGS_DEFAULTS['fxserver.serverConfigPath'];

	function blur(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key !== 'Enter') return;
		event.currentTarget.blur();
	}

	return (
		<div className="space-y-4">
			<SettingRow label="OneSync">
				<Select
					value={onesync}
					onValueChange={(value) => onChange('fxserver.onesync', value)}
					disabled={disabled}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="on">On</SelectItem>
						<SelectItem value="legacy">Legacy</SelectItem>
						<SelectItem value="off">Off</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>

			<Separator />

			<SettingRow label="Server Executable Path">
				<Input
					defaultValue={executablePath}
					disabled={disabled}
					placeholder={SETTINGS_DEFAULTS['fxserver.executablePath']}
					onBlur={(event) => {
						const value = event.currentTarget.value;
						if (value === executablePath) return;

						onChange('fxserver.executablePath', value);
					}}
					onKeyDown={blur}
				/>
			</SettingRow>

			<SettingRow label="Server Data Path">
				<Input
					defaultValue={serverDataPath}
					disabled={disabled}
					placeholder={SETTINGS_DEFAULTS['fxserver.serverDataPath']}
					onBlur={(event) => {
						const value = event.currentTarget.value;
						if (value === serverDataPath) return;

						onChange('fxserver.serverDataPath', value);
					}}
					onKeyDown={blur}
				/>
			</SettingRow>

			<SettingRow label="Config File Path">
				<Input
					defaultValue={serverConfigPath}
					disabled={disabled}
					placeholder={SETTINGS_DEFAULTS['fxserver.serverConfigPath']}
					onBlur={(event) => {
						const value = event.currentTarget.value;
						if (value === serverConfigPath) return;

						onChange('fxserver.serverConfigPath', value);
					}}
					onKeyDown={blur}
				/>
			</SettingRow>
		</div>
	);
}
