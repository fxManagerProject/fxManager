import { icons, type LucideIcon } from 'lucide-react';

export const lucideIconMap = Object.entries(icons).reduce<
	Record<string, LucideIcon>
>((acc, [key, value]) => {
	if (key[0] === key[0].toUpperCase()) {
		acc[key] = value as LucideIcon;
	}
	return acc;
}, {});

export type IconName = keyof typeof lucideIconMap;

export const getIconComponent = (name: string): LucideIcon | null => {
	if (!name) return null;

	const pascalCaseName = name
		.split(/[-_\s]/)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join('');

	return lucideIconMap[pascalCaseName as IconName] || null;
};
