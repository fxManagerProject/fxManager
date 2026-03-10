export interface ReportMessage {
  id: string;
  author: string;
  body: string;
  ts: number;
}

export interface ReportState {
  status: 'open' | 'closed' | 'pending' | null;
  messages: ReportMessage[];
}
