import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@fxmanager/ui/components/dropdown-menu';
import {
	SidebarMenu,
	SidebarMenuButton,
} from '@fxmanager/ui/components/sidebar';
import { User2, ChevronUp, LogOut, X, Moon, Sun } from 'lucide-react';
import { useTheme } from '../theme-provider';
import { Switch } from '@fxmanager/ui/components/switch';
import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';

export function NavUser() {
	const { user, logout } = useAuth();
	const { setTheme, theme } = useTheme();
	const [toggleState, setToggleState] = useState<boolean>(theme === 'light');

	const toggleTheme = (checked: boolean) => {
		setToggleState(checked);
		setTheme(checked ? 'light' : 'dark');
	};

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
						Signed in as{' '}
						<span className="font-semibold text-foreground">
							{user?.username}
						</span>
					</DropdownMenuLabel>

					<DropdownMenuSeparator />

					<div className="flex items-center justify-between px-1.5 py-1">
						<div className="flex items-center gap-2">
							{theme === 'dark' ? (
								<Moon className="h-4 w-4" />
							) : (
								<Sun className="h-4 w-4" />
							)}
							<span className="text-sm">
								{theme === 'dark' ? 'Dark' : 'Light'} Mode
							</span>
						</div>
						<Switch
							id="theme-mode"
							checked={toggleState}
							onCheckedChange={toggleTheme}
						/>
					</div>

					<DropdownMenuSeparator />

					<DropdownMenuItem
						onClick={logout}
						className="text-destructive focus:text-destructive"
					>
						<LogOut className="mr-2 h-4 w-4" />
						Sign out
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</SidebarMenu>
	);
}
