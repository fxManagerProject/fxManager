export type ReportStatus = 'open' | 'inprogress' | 'resolved';
export interface ReportSummary {
	id: number;
	reporterId: number;
	reporterName: string;
	subject: string;
	status: ReportStatus;
	openedAt: number;
	lastAction: number;
}
export interface ReportMessage {
	id: number;
	author: string;
	staff: boolean;
	message: string;
	timestamp: number;
}
export interface ReportDetail extends ReportSummary {
	canReply?: boolean;
	messages: ReportMessage[];
}
