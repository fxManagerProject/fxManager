import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/page-header';

export default function SettingsPage() {
	return (
		<div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
			<PageHeader
				Icon={Settings}
				title="Settings"
				description="Configuration options for fxManager."
			/>
		</div>
	);
}
