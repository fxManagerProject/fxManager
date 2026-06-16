import { ChartBar, InfoIcon } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { PerfDistribution } from './components/perf-distribution';
import { PerfStatsGrid } from './components/process-stats';
import { usePerfSocket } from '@/hooks/ws-channels/use-perf';
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@fxmanager/ui/components/alert';

/* ToDo:
 * Expand performance with the ability to see evolution over time
 * as well as being able to review data from previous sessions.
*/

export default function PerformancePage() {
	const { samples } = usePerfSocket();

	return (
		<div className="flex min-h-[calc(100vh-5rem)] flex-col gap-6">
			<PageHeader
				Icon={ChartBar}
				title="Performance"
				description="Monitor fxServer thread distribution and system resource usage."
			/>

			<Alert>
				<AlertTitle className="flex items-center gap-2 text-base font-semibold tracking-tight text-amber-600 dark:text-amber-500">
					<InfoIcon className="size-4 shrink-0" />
					<span>Under Development</span>
				</AlertTitle>
				<AlertDescription className="text-sm leading-relaxed">
					These metrics represent an initial preview of fxServer telemetry.
					Additional thread diagnostics and historical tracking are coming soon
					in a future update.
				</AlertDescription>
			</Alert>

			<PerfStatsGrid samples={samples} />

			<div className="flex-1">
				<PerfDistribution samples={samples} />
			</div>
		</div>
	);
}
