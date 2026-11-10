import { useEffect, useState, type ComponentType } from 'react';
import { SECTIONS, type SectionKey } from '~/config/sections';
import { ConsoleSection } from './panel/ConsoleSection';
import { ResourcesSection } from './panel/ResourcesSection';
import { PlayersSection } from './panel/PlayersSection';
import { ReportsSection } from './panel/ReportsSection';
import { DashboardSection } from './panel/DashboardSection';
import { Server } from 'lucide-react';
import { PermissionManager } from '@fxmanager/shared/utils';

const SECTION_VIEWS: Record<
	SectionKey,
	ComponentType<{ permissions: number }>
> = {
	dashboard: DashboardSection,
	console: ConsoleSection,
	resources: ResourcesSection,
	players: PlayersSection,
	reports: ReportsSection,
};

interface MainPanelProps {
	permissions: number;
	onClose: () => void;
}

export function MainPanel({ permissions, onClose }: MainPanelProps) {
	const accessibleSections = SECTIONS.filter((section) =>
		PermissionManager.has(permissions, section.permission),
	);
	const [active, setActive] = useState<SectionKey | undefined>(
		accessibleSections[0]?.key,
	);

	// If the role changes and the current tab is no longer allowed, fall back
	// to the first section this role can still see.
	useEffect(() => {
		if (!accessibleSections.some((section) => section.key === active)) {
			setActive(accessibleSections[0]?.key);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [permissions]);

	const ActiveView = active ? SECTION_VIEWS[active] : null;

	return (
		<div className="fixed inset-4 mx-auto flex max-w-[1920px] flex-col rounded-md border bg-card text-card-foreground shadow-sm">
			<header className="flex items-center justify-start gap-2 border-b px-5 py-3">
				<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
					<Server />
				</div>
				<div className="grid flex-1 text-left text-sm leading-tight">
					<span className="text-base font-bold">
						<span className="text-primary">fx</span>Manager Panel
					</span>
				</div>
				<button
					type="button"
					onClick={onClose}
					className="rounded px-3 py-2 text-sm hover:bg-muted"
					aria-label="Close panel"
				>
					Close <kbd className="ml-2 text-xs text-muted-foreground">Esc</kbd>
				</button>
			</header>

			<nav className="flex items-center gap-1 border-b px-3 py-2">
				{accessibleSections.map((section) => (
					<button
						key={section.key}
						onClick={() => setActive(section.key)}
						className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-sm ${
							active === section.key
								? 'bg-secondary text-foreground'
								: 'text-muted-foreground hover:text-foreground'
						}`}
					>
						<section.icon className="h-3.5 w-3.5" />
						{section.label}
					</button>
				))}
				{accessibleSections.length === 0 && (
					<span className="px-2 py-1.5 text-sm text-muted-foreground">
						Your role doesn't have access to any sections.
					</span>
				)}
			</nav>

			<div className="min-h-0 flex-1 overflow-y-auto p-5">
				{ActiveView && <ActiveView permissions={permissions} />}
			</div>
		</div>
	);
}
