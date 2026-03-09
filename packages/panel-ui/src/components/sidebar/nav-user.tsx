import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/use-auth';
import { User2, ChevronUp, LogOut, X } from 'lucide-react';

export function NavUser() {
  const { user, logout } = useAuth();

  return (
    <SidebarMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton className="group/collapsible w-full">
            <User2 className="h-4 w-4 shrink-0" />
            <span className="flex-1 truncate text-left">{user?.username}</span>
            <ChevronUp className="ml-auto h-4 w-4 group-data-[state=open]/collapsible:hidden" />
            <X className="ml-auto h-4 w-4 group-data-[state=closed]/collapsible:hidden" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="center" className="w-48">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Signed in as <span className="font-semibold text-foreground">{user?.username}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenu>
  );
}
