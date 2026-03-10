export type ChannelName = 'server' | 'console' | 'playerlist' | `report:${string}`;

export interface WSEnvelope {
  channel: ChannelName;
  type: string;
  payload: unknown;
  ts: number;
}

export interface LogSegment {
  text: string;
  color?: string;
  bold?: boolean;
}

export interface ConsoleOutputEvent {
  id: number;
  line: string; // raw line with ANSI
  segments: LogSegment[]; // structured line
  source: 'stdout' | 'stderr';
  ts: number;
}
