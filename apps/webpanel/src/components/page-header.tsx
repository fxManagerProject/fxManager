import type { LucideIcon } from 'lucide-react';

export function PageHeader({
	Icon,
	title,
	description,
}: {
	Icon: LucideIcon;
	title: string;
	description?: string;
}) {
	return (
		<header>
			<div className="flex items-center gap-2">
				<Icon className="text-primary" />
				<h1 className="text-2xl font-bold">{title}</h1>
			</div>
			{description && (
				<p className="text-sm text-muted-foreground">{description}</p>
			)}
		</header>
	);
}
