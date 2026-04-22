import { AppSidebar } from '@/components/sidebar/app-sidebar';
import {
	SidebarInset,
	SidebarProvider,
} from '@fxmanager/ui/components/sidebar';
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
	return (
		<SidebarProvider>
			<AppSidebar />
			<SidebarInset>
				<div className="flex flex-1 flex-col gap-4 p-4">
					<Outlet />
				</div>
			</SidebarInset>
		</SidebarProvider>
	);
}
