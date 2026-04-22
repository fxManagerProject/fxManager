import { ChevronRightIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
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

function NavItemWithSubItems({ item }: { item: NavItem }) {
	const NavIcon = item.icon;

	return (
		<Collapsible
			asChild
			defaultOpen={item.isActive}
			className="group/collapsible"
		>
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
						{item.items?.map((subItem) => (
							<SidebarMenuSubItem key={subItem.title}>
								<SidebarMenuSubButton asChild>
									<Link to={subItem.url}>
										<span>{subItem.title}</span>
									</Link>
								</SidebarMenuSubButton>
							</SidebarMenuSubItem>
						))}
					</SidebarMenuSub>
				</CollapsibleContent>
			</SidebarMenuItem>
		</Collapsible>
	);
}

export function NavItemNoItems({ item }: { item: NavItem }) {
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
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Platform</SidebarGroupLabel>
			<SidebarMenu>
				{NAV.map((item) => {
					const subItems = !!item.items;

					if (subItems)
						return <NavItemWithSubItems item={item} key={item.url} />;
					return <NavItemNoItems item={item} key={item.url} />;
				})}
			</SidebarMenu>
		</SidebarGroup>
	);
}
