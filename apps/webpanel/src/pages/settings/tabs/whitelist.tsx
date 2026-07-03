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
import { Button } from '@fxmanager/ui/components/button';
import { useState, useEffect } from 'react';
import { Label } from '@fxmanager/ui/components/label';

type RoleListSettingProps = {
	value: string[];
	disabled?: boolean;
	onSave: (value: string[]) => void;
};

export function RoleListSetting({
	value,
	disabled,
	onSave,
}: RoleListSettingProps) {
	const [draft, setDraft] = useState(value);

	useEffect(() => {
		setDraft(value);
	}, [value]);

	function addRole() {
		setDraft((prev) => [...prev, '']);
	}

	function updateRole(index: number, roleId: string) {
		setDraft((prev) => prev.map((item, i) => (i === index ? roleId : item)));
	}

	function removeRole(index: number) {
		setDraft((prev) => prev.filter((_, i) => i !== index));
	}

	function cancel() {
		setDraft(value);
	}

	function save() {
		onSave(draft.filter(Boolean));
	}

	const isDirty = JSON.stringify(draft) !== JSON.stringify(value);

	return (
		<div className="space-y-3 w-100">
			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					onClick={addRole}
				>
					Add role
				</Button>

				<Button type="button" disabled={disabled || !isDirty} onClick={save}>
					Save
				</Button>

				<Button
					type="button"
					variant="ghost"
					disabled={disabled || !isDirty}
					onClick={cancel}
				>
					Cancel
				</Button>
			</div>

			<div className="space-y-2">
				{draft.map((roleId, index) => (
					<div key={String(index)} className="flex gap-2">
						<Input
							value={roleId}
							disabled={disabled}
							placeholder="Discord role ID"
							onChange={(event) => updateRole(index, event.currentTarget.value)}
						/>

						<Button
							type="button"
							variant="secondary"
							disabled={disabled}
							onClick={() => removeRole(index)}
						>
							Remove
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}

export default function WhitelistTab({
	data,
	onChange,
	disabled,
}: SettingsTabProps<'whitelist'>) {
	const mode = data['whitelist.mode'] ?? SETTINGS_DEFAULTS['whitelist.mode'];
	const discordBotToken = data['whitelist.discordBotToken'] ?? '';
	const discordGuildId = data['whitelist.discordGuildId'] ?? '';
	const discordRoleIds = data['whitelist.discordRoleIds']?.split(',') ?? [];

	function blur(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key !== 'Enter') return;
		event.currentTarget.blur();
	}

	return (
		<div className="space-y-4">
			<SettingRow label="Whitelist Mode">
				<Select
					value={mode}
					onValueChange={(value) => onChange('whitelist.mode', value)}
					disabled={disabled}
				>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="none">None</SelectItem>
						<SelectItem value="admin-only">Admin Only</SelectItem>
						<SelectItem value="identifier">Identifier</SelectItem>
						<SelectItem value="discord">Discord Roles</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>

			<Separator />

			<SettingRow label="Discord Bot Token">
				<Input
					className={discordBotToken && 'blur-xs focus:blur-none'}
					defaultValue={discordBotToken}
					disabled={disabled}
					placeholder={'XXXXXXXXXXXXXXXXXXX'}
					onBlur={(event) => {
						const value = event.currentTarget.value;
						if (value === discordBotToken) return;

						onChange('whitelist.discordBotToken', value);
					}}
					onKeyDown={blur}
				/>
			</SettingRow>

			<SettingRow label="Discord Guild ID">
				<Input
					defaultValue={discordGuildId}
					disabled={disabled}
					placeholder={'1234567890123456789'}
					onBlur={(event) => {
						const value = event.currentTarget.value;
						if (value === discordGuildId) return;

						onChange('whitelist.discordGuildId', value);
					}}
					onKeyDown={blur}
				/>
			</SettingRow>

			<div className="flex flex-col gap-4">
				<Label>Discord Roles</Label>

				<RoleListSetting
					value={discordRoleIds}
					disabled={disabled}
					onSave={(roles) => {
						onChange('whitelist.discordRoleIds', roles.join(','));
						console.log(roles);
					}}
				/>
			</div>
		</div>
	);
}
