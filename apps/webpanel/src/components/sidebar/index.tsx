import { AppSidebar } from '@/components/sidebar/app-sidebar';
import {
	SidebarInset,
	SidebarProvider,
} from '@fxmanager/ui/components/sidebar';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
	return (
		<SidebarProvider className="h-screen overflow-hidden">
			<AppSidebar />
			<SidebarInset className="h-screen overflow-hidden">
				<div className="flex flex-col h-full overflow-hidden gap-4">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
