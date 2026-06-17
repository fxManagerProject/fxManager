import { useTheme } from '@/components/theme-provider';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import SettingRow from '../components/settingrow';

export default function GeneralTab() {
	const { theme, setTheme } = useTheme();

	return (
		<div>
			<SettingRow label="Theme">
				<Select defaultValue={theme} onValueChange={setTheme}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="dark">Dark</SelectItem>
						<SelectItem value="light">Light</SelectItem>
						<SelectItem value="system">System</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>
		</div>
	);
}
