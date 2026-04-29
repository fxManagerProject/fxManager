import { useEffect, useState } from 'react';
import type { Channel } from '@fxmanager/shared/types';
import { useWSBase } from './use-ws-core';

export interface Report {
	id: string;
	reason: string;
	reportedBy: string;
	reportedPlayer: string;
	status: 'open' | 'under_review' | 'resolved';
	createdAt: number;
}

interface UseReportsReturn {
	reports: Report[];
	getReport: (id: string) => Report | undefined;
}

// No reportId = subscribe to general feed (all reports)
// reportId    = subscribe to that specific report's channel
export function useReportsSocket(reportId?: number): UseReportsReturn {
	const { subscribe, unsubscribe, on } = useWSBase();
	const [reports, setReports] = useState<Report[]>([]);

	const channel: Channel = reportId ? `report:${reportId}` : 'report:general';

	useEffect(() => {
		subscribe(channel);

		const offNew = on<Report>(channel, 'new_report', (msg) => {
			setReports((prev) => [msg.data, ...prev]);
		});

		const offUpdated = on<Report>(channel, 'report_updated', (msg) => {
			setReports((prev) =>
				prev.map((r) => (r.id === msg.data.id ? { ...r, ...msg.data } : r)),
			);
		});

		const offResolved = on<{ id: string }>(
			channel,
			'report_resolved',
			(msg) => {
				setReports((prev) =>
					prev.map((r) =>
						r.id === msg.data.id ? { ...r, status: 'resolved' } : r,
					),
				);
			},
		);

		return () => {
			offNew();
			offUpdated();
			offResolved();
			unsubscribe(channel);
		};
	}, [subscribe, unsubscribe, on, channel]);

	return {
		reports,
		getReport: (id) => reports.find((r) => r.id === id),
	};
}
