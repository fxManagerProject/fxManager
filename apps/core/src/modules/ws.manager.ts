import type { WebSocket } from '@fastify/websocket';
import type { Channel, WSClientMessage, WSMessage } from '@fxmanager/shared/types';
import type { FastifyRequest } from 'fastify';
import type { AuthedRequest } from '../types';

interface Subscription {
	id: string;
  socket: WebSocket;
  channels: Set<Channel>;
	admin: AuthedRequest['admin'];
}

type ServerHandler<T = unknown> = (client: Subscription, event: string, data: T) => void;
type InitialDataProvider<T = unknown> = (clientId: string, channel: string) => Promise<T> | T;

class WSManager {
  private clients = new Map<string, Subscription>();
  private callbacks = new Map<string, Set<ServerHandler>>();
  private initialProviders = new Map<Channel, InitialDataProvider>();

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

  private async handleClientMessage(id: string, msg: WSClientMessage) {
    const sub = this.clients.get(id);
    if (!sub) return;

    if (msg.type === 'subscribe') {
      sub.channels.add(msg.channel);
      await this.sendInitialData(id, msg.channel);
    } else if (msg.type === 'unsubscribe') {
      sub.channels.delete(msg.channel);
    } else if (msg.type === 'emit') {
			this.triggerCallbacks(sub, msg.channel, msg.event, msg.data);
		}
  }

	private async sendInitialData(clientId: string, channel: Channel) {
    let provider = this.initialProviders.get(channel);

		if (!provider) {
			const prefix = channel.split(':')[0] + ':*';
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
      console.error(`[ws] Failed to send initial data for channel ${channel}:`, err);
    }
  }

	private triggerCallbacks(client: Subscription, channel: Channel, event: string, data: unknown) {
    const exactKey = `${channel}:${event}`;
    this.callbacks.get(exactKey)?.forEach((h) => h(client, event, data));

    const wildcardKey = `${channel}:*`;
    this.callbacks.get(wildcardKey)?.forEach((h) => h(client, event, data));
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

	on<T>(channel: Channel, event: string, handler: ServerHandler<T>): () => void {
    const key = `${channel}:${event}`;
    if (!this.callbacks.has(key)) this.callbacks.set(key, new Set());
    this.callbacks.get(key)!.add(handler as ServerHandler);

    return () => this.callbacks.get(key)?.delete(handler as ServerHandler);
  }

  onChannel<T>(channel: Channel, handler: ServerHandler<T>): () => void {
    return this.on(channel, '*', handler);
  }
}

export const wsManager = new WSManager();
