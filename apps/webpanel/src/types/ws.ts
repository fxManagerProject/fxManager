import type { Channel, WSMessage } from '@fxmanager/shared/types';

export type MessageHandler<T = unknown> = (message: WSMessage<T>) => void;

export interface WSContextValue {
	subscribe: (channel: Channel) => void;
	unsubscribe: (channel: Channel) => void;
	on: <T>(
		channel: Channel,
		event: string,
		handler: MessageHandler<T>,
	) => () => void;
	emit: <T>(channel: Channel, event: string, data: T) => void;
	connected: boolean;
}
