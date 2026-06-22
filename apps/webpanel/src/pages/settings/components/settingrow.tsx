import { Label } from '@fxmanager/ui/components/label';

export default function SettingRow({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="space-y-0.5">
				<Label>{label}</Label>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			<div className="sm:max-w-sm sm:w-full">{children}</div>
		</div>
	);
}
