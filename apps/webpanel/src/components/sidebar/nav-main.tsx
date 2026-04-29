import { ChevronRightIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@fxmanager/ui/components/collapsible';
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from '@fxmanager/ui/components/sidebar';
import type { NavItem } from '@/types/sidebar';
import { NAV } from '@/static/navigation';
import { useAuth } from '@/hooks/use-auth';
import type { AuthUser } from '@/types/auth';
import { PermissionManager } from '@fxmanager/shared/utils';

function NavItemWithSubItems({
	item,
	user,
}: {
	item: NavItem;
	user: AuthUser;
}) {
	const { pathname } = useLocation();
	const NavIcon = item.icon;

	if (
		item.permission &&
		!PermissionManager.has(user.permissions, item.permission)
	)
		return;

	const isActive =
		pathname === item.url ||
		item.items?.some((subItem) => pathname === subItem.url);

	return (
		<Collapsible asChild defaultOpen={isActive} className="group/collapsible">
			<SidebarMenuItem>
				<CollapsibleTrigger asChild>
					<SidebarMenuButton tooltip={item.title}>
						{NavIcon && <NavIcon />}
						<span>{item.title}</span>
						<ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
					</SidebarMenuButton>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<SidebarMenuSub>
						{item.items?.map((subItem) => {
							if (
								subItem.permission &&
								!PermissionManager.has(user.permissions, subItem.permission)
							)
								return null;

							return (
								<SidebarMenuSubItem key={subItem.title}>
									<SidebarMenuSubButton asChild>
										<Link to={subItem.url}>
											<span>{subItem.title}</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							);
						})}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

export function NavItemNoItems({
	item,
	user,
}: {
	item: NavItem;
	user: AuthUser;
}) {
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
		<SidebarGroup>
			<SidebarGroupLabel>Platform</SidebarGroupLabel>
			<SidebarMenu>
				{user &&
					NAV.map((item) => {
						const subItems = !!item.items;

						if (subItems)
							return (
								<NavItemWithSubItems user={user} item={item} key={item.url} />
							);
						return <NavItemNoItems user={user} item={item} key={item.url} />;
					})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
