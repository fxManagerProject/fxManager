import type { AdminGroup } from '@fxmanager/shared/types';
import { Badge } from '@fxmanager/ui/components/badge';
import {
	DynamicIcon,
	type LucidIconName,
} from '@fxmanager/ui/components/dynamic-icon';

type GroupBadgeProps = {
	group: Pick<AdminGroup, 'name' | 'colour' | 'icon'>;
};

export function GroupBadge({ group }: GroupBadgeProps) {
	return (
		<Badge style={{ backgroundColor: group.colour }} className="text-white">
			{group.icon && <DynamicIcon name={group.icon as LucidIconName} />}
			{group.name}
		</Badge>
	);
}
