import { useSidebar } from '@fxmanager/ui/components/sidebar';
import { PanelLeftIcon, PanelLeftOpen, type LucideIcon } from 'lucide-react';

export function PageHeader({
	Icon,
	title,
	description,
}: {
	Icon: LucideIcon;
	title: string;
	description?: string;
}) {
	const { toggleSidebar } = useSidebar();

	return (
		<header className="space-y-1">
			<div className="flex items-center gap-3">
				<button
					type="button"
					className="group/logo md:hidden flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground 
                    transition-all duration-300 cursor-pointer hover:scale-105 hover:shadow-lg hover:shadow-primary/40"
					onClick={toggleSidebar}
				>
					<div className="relative flex items-center justify-center">
						<PanelLeftIcon className="size-5 transition-all duration-300 group-hover/logo:opacity-0 group-hover/logo:scale-50" />
						<PanelLeftOpen className="size-5 absolute opacity-0 scale-50 transition-all duration-300 group-hover/logo:opacity-100 group-hover/logo:scale-100" />
					</div>
				</button>

				<div className="flex items-center gap-2">
					<Icon className="text-primary h-6 w-6" />
					<h1 className="text-2xl font-bold tracking-tight">{title}</h1>
				</div>
			</div>

			{description && (
				<p className="text-sm text-muted-foreground ml-0 md:ml-0">
					{description}
				</p>
			)}
		</header>
	);
}
