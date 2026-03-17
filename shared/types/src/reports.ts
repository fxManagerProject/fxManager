// consider altering to inferred types ?

export interface ReportRecap {
  id: number;
  playerId: number;
  subject: string;
  status: 'open' | 'inprogress' | 'resolved';
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
