// consider altering to inferred types ?

export type ReportStatus = 'open' | 'inprogress' | 'resolved'

export interface ReportRecap {
  id: number;
  playerId: number;
  subject: string;
  status: ReportStatus;
  openedAt: Date;
  lastAction: Date;
}

export type ReportMessage =
  | {
      id: number;
      playerId: number;
      message: string;
      timestamp: Date;
    }
  | {
      id: number;
      playerId: number;
      message: string;
      timestamp: Date;
    };

export interface Report extends ReportRecap {
  messages: ReportMessage[];
}
