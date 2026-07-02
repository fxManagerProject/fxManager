export type Channel =
	| 'server_state'
	| 'resourcelist'
	| 'playerlist'
	| 'console'
	| 'perf'
	| 'sessions'
	| 'disconnects'
	| `report:general`
	| `report:${number}`;

export interface WSMessage<T = unknown> {
	channel: Channel;
	event: string;
	data: T;
}

export type WSClientMessage =
	| {
			type: 'subscribe' | 'unsubscribe';
			channel: Channel;
	  }
	| {
			type: 'emit';
			channel: Channel;
			event: string;
			data: unknown;
	  };
