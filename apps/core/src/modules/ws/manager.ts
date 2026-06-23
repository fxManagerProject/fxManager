import type { WebSocket } from '@fastify/websocket';
import type {
	Channel,
	WSClientMessage,
	WSMessage,
} from '@fxmanager/shared/types';
import type { AuthedRequest } from '../../types';

interface Subscription {
	id: string;
	socket: WebSocket;
	channels: Set<Channel>;
	admin: AuthedRequest['admin'];
}

type ServerHandler<T = unknown> = (
	client: Subscription,
	event: string,
	data: T,
) => void;
type InitialDataProvider<T = unknown> = (
	clientId: string,
	channel: Channel,
) => Promise<T> | T;
type CanConnectHandler = (
	admin: AuthedRequest['admin'],
	channel: Channel,
) => Promise<boolean> | boolean;

class WSManager {
	private clients = new Map<string, Subscription>();
	private callbacks = new Map<string, Set<ServerHandler>>();
	private initialProviders = new Map<Channel, InitialDataProvider>();
	private connectionChecks = new Map<Channel, CanConnectHandler>();

	add(id: string, socket: WebSocket, admin: AuthedRequest['admin']) {
		this.clients.set(id, { id, socket, channels: new Set(), admin });

		socket.on('message', (raw: string) => {
			try {
				const msg = JSON.parse(raw.toString()) as WSClientMessage;
				this.handleClientMessage(id, msg);
			} catch {}
		});

		socket.on('close', () => this.remove(id));
	}

	setInitialData<T>(channel: Channel, provider: InitialDataProvider<T>) {
		this.initialProviders.set(channel, provider as InitialDataProvider);
	}

	addCheck(channel: Channel, handler: CanConnectHandler) {
		this.connectionChecks.set(channel, handler);
	}

	private async handleClientMessage(id: string, msg: WSClientMessage) {
		const sub = this.clients.get(id);
		if (!sub) return;

		const { channel, type } = msg;

		if (msg.type === 'subscribe') {
			let canConnectHandler = this.connectionChecks.get(msg.channel);

			if (!canConnectHandler) {
				const [root] = channel.split(':');
				const prefix = `${root}:*`;

				canConnectHandler = this.connectionChecks.get(prefix as Channel);
			}

			if (canConnectHandler && !canConnectHandler(sub.admin, channel)) return;

			sub.channels.add(channel);

			await this.sendInitialData(id, channel);
		} else if (type === 'unsubscribe') {
			sub.channels.delete(channel);
		} else if (type === 'emit') {
			const { event, data } = msg;
			this.triggerCallbacks(sub, channel, event, data);
		}
	}

	private async sendInitialData(clientId: string, channel: Channel) {
		let provider = this.initialProviders.get(channel);

		if (!provider) {
			const [root] = channel.split(':');
			const prefix = `${root}:*`;

			provider = this.initialProviders.get(prefix as Channel);
		}

		if (!provider) return;

		try {
			const data = await provider(clientId, channel);
			this.send(clientId, {
				channel,
				event: 'initial',
				data,
			});
		} catch (err) {
			console.error(
				`[ws] Failed to send initial data for channel ${channel}:`,
				err,
			);
		}
	}

	private triggerCallbacks(
		client: Subscription,
		channel: Channel,
		event: string,
		data: unknown,
	) {
		const exactKey = `${channel}:${event}`;
		this.callbacks.get(exactKey)?.forEach((h) => {
			h(client, event, data);
		});

		const wildcardKey = `${channel}:*`;
		this.callbacks.get(wildcardKey)?.forEach((h) => {
			h(client, event, data);
		});
	}

	remove(id: string) {
		this.clients.delete(id);
	}

	broadcast<T>(message: WSMessage<T>) {
		const payload = JSON.stringify(message);
		for (const sub of this.clients.values()) {
			if (sub.channels.has(message.channel) && sub.socket.readyState === 1) {
				sub.socket.send(payload);
			}
		}
	}

	send<T>(clientId: string, message: WSMessage<T>) {
		const sub = this.clients.get(clientId);
		if (sub?.socket.readyState === 1) {
			sub.socket.send(JSON.stringify(message));
		}
	}

	on<T>(
		channel: Channel,
		event: string,
		handler: ServerHandler<T>,
	): () => void {
		const key = `${channel}:${event}`;
		if (!this.callbacks.has(key)) this.callbacks.set(key, new Set());
		this.callbacks.get(key)?.add(handler as ServerHandler);

		return () => this.callbacks.get(key)?.delete(handler as ServerHandler);
	}

	onChannel<T>(channel: Channel, handler: ServerHandler<T>): () => void {
		return this.on(channel, '*', handler);
	}
}

export const wsManager = new WSManager();
