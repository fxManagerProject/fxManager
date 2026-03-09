import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import type { NavItem } from '@/types/sidebar';
import { ChevronRightIcon, ExternalLink, MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { NAV } from '@/static/navigation';

function NavItemWithSubItems({ item }: { item: NavItem }) {
  const NavIcon = item.icon;

  return (
    <Collapsible asChild defaultOpen={item.isActive} className="group/collapsible">
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
                  <a href={subItem.url}>
                    <span>{subItem.title}</span>
                  </a>
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
  const { isMobile } = useSidebar();

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild tooltip={item.title}>
        <a href={item.url}>
          {item.icon && <item.icon />}
          <span>{item.title}</span>
        </a>
      </SidebarMenuButton>

      {/* Optional: Actions dropdown if you still want a "More" menu for these items */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-48 rounded-lg"
          side={isMobile ? 'bottom' : 'right'}
          align={isMobile ? 'end' : 'start'}
        >
          <DropdownMenuItem>
            <ExternalLink className="text-muted-foreground" />
            <span>Open in New Tab</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
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

          if (subItems) return <NavItemWithSubItems item={item} key={item.url} />;
          return <NavItemNoItems item={item} key={item.url} />;

          // return (
          //   <Collapsible
          //     key={item.title}
          //     asChild
          //     defaultOpen={item.isActive}
          //     className="group/collapsible"
          //   >
          //     <SidebarMenuItem>
          //       <CollapsibleTrigger asChild>
          //         <SidebarMenuButton tooltip={item.title}>
          //           {NavIcon && <NavIcon />}
          //           <span>{item.title}</span>
          //           <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          //         </SidebarMenuButton>
          //       </CollapsibleTrigger>
          //       <CollapsibleContent>
          //         <SidebarMenuSub>
          //           {item.items?.map((subItem) => (
          //             <SidebarMenuSubItem key={subItem.title}>
          //               <SidebarMenuSubButton asChild>
          //                 <a href={subItem.url}>
          //                   <span>{subItem.title}</span>
          //                 </a>
          //               </SidebarMenuSubButton>
          //             </SidebarMenuSubItem>
          //           ))}
          //         </SidebarMenuSub>
          //       </CollapsibleContent>
          //     </SidebarMenuItem>
          //   </Collapsible>
          // )
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
