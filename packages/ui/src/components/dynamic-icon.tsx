import * as Icons from 'lucide-react';

export type LucidIconName = keyof typeof Icons;

interface IconProps {
	name: LucidIconName;
	color?: string;
	size?: number;
	className?: string;
}

/** Returns a lucide icon for a given string name */
export const DynamicIcon = ({ name, color, size, className }: IconProps) => {
	// biome-ignore lint/performance/noDynamicNamespaceImportAccess: required
	const LucideIcon = Icons[name] as React.ElementType;
	return LucideIcon ? (
		<LucideIcon color={color} size={size} className={className} />
	) : (
		<Icons.FileQuestion color={color} size={size} className={className} />
	);
};
