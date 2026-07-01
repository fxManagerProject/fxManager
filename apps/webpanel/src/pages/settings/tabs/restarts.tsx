import { useCallback, useEffect, useState } from 'react';
import type {
	ApiResponse,
	RestartScheduleStatus,
} from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Label } from '@fxmanager/ui/components/label';
import { Separator } from '@fxmanager/ui/components/separator';
import { Switch } from '@fxmanager/ui/components/switch';
import { toast } from 'sonner';
import SettingRow from '../components/settingrow';
import type { SettingsTabProps } from '@/types/settings';
import { QueryService } from '@/lib/query';

type TimeListProps = {
	value: string[];
	disabled?: boolean;
	onSave: (value: string[]) => void;
};

function TimeListSetting({ value, disabled, onSave }: TimeListProps) {
	const [draft, setDraft] = useState(value);

	useEffect(() => {
		setDraft(value);
	}, [value]);

	const addTime = () => setDraft((prev) => [...prev, '00:00']);
	const updateTime = (index: number, next: string) =>
		setDraft((prev) => prev.map((item, i) => (i === index ? next : item)));
	const removeTime = (index: number) =>
		setDraft((prev) => prev.filter((_, i) => i !== index));
	const cancel = () => setDraft(value);
	const save = () => onSave(draft.filter(Boolean));

	const isDirty = JSON.stringify(draft) !== JSON.stringify(value);

	return (
		<div className="space-y-3 w-100">
			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					disabled={disabled}
					onClick={addTime}
				>
					Add time
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
				{draft.map((time, index) => (
					<div key={String(index)} className="flex gap-2">
						<Input
							type="time"
							value={time}
							disabled={disabled}
							onChange={(event) => updateTime(index, event.currentTarget.value)}
						/>

						<Button
							type="button"
							variant="secondary"
							disabled={disabled}
							onClick={() => removeTime(index)}
						>
							Remove
						</Button>
					</div>
				))}
			</div>
		</div>
	);
}

export default function RestartsTab({
	data,
	onChange,
	disabled,
}: SettingsTabProps<'restarts'>) {
	const enabled = data['restarts.enabled'] === 'true';
	const times = data['restarts.times']?.split(',').filter(Boolean) ?? [];

	const [status, setStatus] = useState<RestartScheduleStatus | null>(null);
	const [skipping, setSkipping] = useState(false);

	const fetchStatus = useCallback(async () => {
		try {
			const res = await QueryService<ApiResponse<RestartScheduleStatus>>({
				endpoint: '/server/schedule',
				method: 'GET',
			});
			if (res.success) setStatus(res.data);
		} catch {
			// best-effort; the editor still works without live status
		}
	}, []);

	useEffect(() => {
		void fetchStatus();
	}, [fetchStatus]);

	async function skipNext() {
		setSkipping(true);
		try {
			const res = await QueryService<
				ApiResponse<{ skipped: boolean; nextRestart: string | null }>
			>({ endpoint: '/server/schedule/skip', method: 'POST' });

			if (res.success && res.data.skipped) {
				toast.success('Next scheduled restart skipped.');
			} else {
				toast.info('No upcoming restart to skip.');
			}

			await fetchStatus();
		} catch {
			toast.error('Failed to skip restart.');
		}
		setSkipping(false);
	}

	const nextRestart = status?.nextRestart
		? new Date(status.nextRestart).toLocaleString()
		: '—';

	return (
		<div className="space-y-4">
			<SettingRow label="Enable scheduled restarts">
				<Switch
					checked={enabled}
					disabled={disabled}
					onCheckedChange={(checked) =>
						onChange('restarts.enabled', checked ? 'true' : 'false')
					}
				/>
			</SettingRow>

			<Separator />

			<div className="flex flex-col gap-4">
				<Label>Restart times (server local time)</Label>

				<TimeListSetting
					value={times}
					disabled={disabled}
					onSave={(next) => onChange('restarts.times', next.join(','))}
				/>
			</div>

			<Separator />

			<SettingRow label="Next restart">
				<div className="flex items-center gap-3">
					<span className="text-sm text-muted-foreground">
						{status?.skipped ? `${nextRestart} (next skipped)` : nextRestart}
					</span>

					<Button
						type="button"
						variant="secondary"
						disabled={disabled || skipping || !status?.nextRestart}
						onClick={skipNext}
					>
						Skip next restart
					</Button>
				</div>
			</SettingRow>
		</div>
	);
}
