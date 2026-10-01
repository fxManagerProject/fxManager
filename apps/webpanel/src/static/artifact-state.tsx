import {
	ArrowUpCircle,
	CheckCircle2,
	Info,
	type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ArtifactStatus } from '@/lib/artifact-version';

interface ArtifactStatePresentation {
	Icon: LucideIcon;
	className: string;
	label: (recommended: string) => ReactNode;
}

/**
 * Presentation for the artifact status strip. Every state renders the same
 * strip so the card reads consistently — only the tone, icon and wording
 * differ, which keeps the primary accent on the one state that asks the admin
 * to do something. 'unknown' has no entry: nothing is claimed when either
 * build is missing.
 */
export const ARTIFACT_STATE: Record<
	Exclude<ArtifactStatus, 'unknown'>,
	ArtifactStatePresentation
> = {
	outdated: {
		Icon: ArrowUpCircle,
		className:
			'border-primary/30 bg-primary/10 text-primary hover:bg-primary/20',
		label: (recommended) => (
			<>
				<span className="font-mono">b{recommended}</span> recommended
			</>
		),
	},
	current: {
		Icon: CheckCircle2,
		className: 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
		label: () => 'Up to date',
	},
	ahead: {
		Icon: Info,
		className: 'border-border bg-muted/50 text-muted-foreground hover:bg-muted',
		label: (recommended) => (
			<>
				Ahead of <span className="font-mono">b{recommended}</span>
			</>
		),
	},
};
