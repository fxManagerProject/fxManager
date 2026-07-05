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
import { Field, FieldDescription } from '@fxmanager/ui/components/field';
import { validateStartupArguments } from '@fxmanager/shared/utils';
import { useState } from 'react';

function blur(event: React.KeyboardEvent<HTMLInputElement>) {
	if (event.key !== 'Enter') return;
	event.currentTarget.blur();
}

function StartupArgumentsField({
	value: defaultValue,
	disabled,
	onChange,
}: {
	value: string;
	disabled: boolean;
	onChange: (value: string) => void;
}) {
	const [error, setError] = useState('');

	return (
		<Field data-invalid={error !== ''} className="gap-0.5">
			<Input
				defaultValue={defaultValue}
				disabled={disabled}
				placeholder={'+exec server.cfg'}
				onBlur={(event) => {
					const value = event.currentTarget.value.trim();
					const validation = validateStartupArguments(value);

					if (validation.valid !== true) {
						setError(`"${validation.argument}" is not allowed here.`);
						return;
					}

					setError('');
					onChange(value);
				}}
				onKeyDown={blur}
			/>
			<FieldDescription>{error}</FieldDescription>
		</Field>
	);
}

export default function FXServerTab({
	data,
	onChange,
	disabled,
}: SettingsTabProps<'fxserver'>) {
	const onesync =
		data['fxserver.onesync'] ?? SETTINGS_DEFAULTS['fxserver.onesync'];
	const startupArguments = data['fxserver.startupArguments'] ?? '';
	const serverDataPath =
		data['fxserver.serverDataPath'] ??
		SETTINGS_DEFAULTS['fxserver.serverDataPath'];
	const executablePath =
		data['fxserver.executablePath'] ??
		SETTINGS_DEFAULTS['fxserver.executablePath'];
	const serverConfigPath =
		data['fxserver.serverConfigPath'] ??
		SETTINGS_DEFAULTS['fxserver.serverConfigPath'];

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

			<SettingRow label="Startup Arguments">
				<StartupArgumentsField
					disabled={disabled}
					value={startupArguments}
					onChange={(value) => {
						if (value === startupArguments) return;

						onChange('fxserver.startupArguments', value);
					}}
				/>
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
