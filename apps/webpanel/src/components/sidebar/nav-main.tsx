import { Link } from 'react-router-dom';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenuButton,
	SidebarMenuItem,
} from '@fxmanager/ui/components/sidebar';
import type { NavItem } from '@/types/sidebar';
import { NAV_GROUPS } from '@/static/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { AuthUser } from '@/types/auth';
import { PermissionManager } from '@fxmanager/shared/utils';

function NavItemNoItems({ item, user }: { item: NavItem; user: AuthUser }) {
	if (
		item.permission &&
		!PermissionManager.has(user.permissions, item.permission)
	)
		return;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton asChild tooltip={item.title}>
				<Link to={item.url}>
					{item.icon && <item.icon />}
					<span>{item.title}</span>
				</Link>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

export function NavMain() {
	const { user } = useAuth();

	return (
		<>
			{user &&
				NAV_GROUPS.map((group) => {
					return (
						<SidebarGroup key={group.title}>
							<SidebarGroupLabel>{group.title}</SidebarGroupLabel>
							{group.items.map((item) => (
								<NavItemNoItems item={item} user={user} key={item.title} />
							))}
						</SidebarGroup>
					);
				})}
		</>
	);
}
