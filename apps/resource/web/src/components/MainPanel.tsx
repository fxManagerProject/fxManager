import { useEffect, useState, type ComponentType } from 'react';
import { SECTIONS, type SectionKey } from '~/config/sections';
import { canAccess, type Permissions } from '~/lib/access';
import { ConsoleSection } from './sections/ConsoleSection';
import { ResourcesSection } from './sections/ResourcesSection';
import { PlayersSection } from './sections/PlayersSection';
import { ReportsSection } from './sections/ReportsSection';
import { Server } from 'lucide-react';

const SECTION_VIEWS: Record<SectionKey, ComponentType> = {
	console: ConsoleSection,
	resources: ResourcesSection,
	players: PlayersSection,
	reports: ReportsSection,
};

interface MainPanelProps {
	role: Permissions;
	onClose: () => void;
}

export function MainPanel({ role, onClose }: MainPanelProps) {
	const accessibleSections = SECTIONS.filter((section) =>
		canAccess(role, section.requires),
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
	}, [role]);

	const ActiveView = active ? SECTION_VIEWS[active] : null;

	return (
		<div className="fixed inset-4 flex flex-col rounded-md border bg-card text-card-foreground shadow-sm">
			<header className="flex items-center justify-start gap-2 border-b px-5 py-3">
				<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
					<Server />
				</div>
				<div className="grid flex-1 text-left text-sm leading-tight">
					<span className="text-base font-bold">
						<span className="text-primary">fx</span>Manager Panel
					</span>
				</div>
				<kbd className="text-xs text-muted-foreground">F7</kbd>
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

			<div className="flex-1 overflow-y-auto p-4">
				{ActiveView && <ActiveView />}
			</div>
		</div>
	);
}
