import type { SettingsKey, SettingsScope } from '@fxmanager/shared/types';

export type SettingsTabProps<S extends SettingsScope> = {
	data: Partial<Record<SettingsKey<S>, string>>;
	onChange: (key: SettingsKey<S>, value: string) => void;
	disabled: boolean;
};
