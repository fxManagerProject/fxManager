'use client';
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenuButton,
	SidebarRail,
	useSidebar,
} from '@fxmanager/ui/components/sidebar';
import { PanelLeftClose, PanelLeftOpen, Server } from 'lucide-react';
import type * as React from 'react';
import { NavMain } from './nav-main';
import { NavUser } from './nav-user';
import { ServerStatusCard } from './server-status';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
	const { toggleSidebar, open, openMobile } = useSidebar();

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenuButton
					size="lg"
					variant="ghost"
					onClick={toggleSidebar}
					className="group/logo"
				>
					<div
						className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground 
                        transition-all duration-200 
                        group-hover/logo:scale-110 group-hover/logo:shadow-lg group-hover/logo:shadow-primary/40"
					>
						<Server className="transition-all duration-200 group-hover/logo:opacity-0 group-hover/logo:scale-50 absolute" />
						{open || openMobile ? (
							<PanelLeftClose className="opacity-0 scale-50 transition-all duration-200 group-hover/logo:opacity-100 group-hover/logo:scale-100" />
						) : (
							<PanelLeftOpen className="opacity-0 scale-50 transition-all duration-200 group-hover/logo:opacity-100 group-hover/logo:scale-100" />
						)}
					</div>

					<div className="grid flex-1 text-left text-sm leading-tight">
						<span className="text-base font-bold">
							<span className="text-primary">fx</span>Manager
						</span>
					</div>
				</SidebarMenuButton>
			</SidebarHeader>
			<SidebarContent>
				<NavMain />
				<ServerStatusCard />
			</SidebarContent>
			<SidebarFooter>
				<NavUser />
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
