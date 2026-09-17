import { CallbackPayload, CallbackResponse, EVENT_NAMES } from '@common/types';

type ClientCallbackHandler<TInput, TOutput> = (
	data: TInput,
) => TOutput | Promise<TOutput>;

export class ClientCallbackManager {
	private handlers = new Map<string, ClientCallbackHandler<any, any>>();
	private pendingRequests = new Map<
		string,
		{ resolve: (val: any) => void; timer: CitizenTimer }
	>();

	constructor() {
		this.listenForServerRequests();
		this.listenForServerResponses();
	}

	/**
	 * Register a callback that the server can invoke.
	 */
	register<TInput = any, TOutput = any>(
		name: string,
		handler: ClientCallbackHandler<TInput, TOutput>,
	): void {
		this.handlers.set(name, handler);
	}

	/**
	 * Trigger a callback on the server and await the response.
	 */
	async trigger<TOutput = any, TInput = any>(
		name: string,
		payload?: TInput,
		options: { timeoutMs?: number; fallback?: TOutput } = {},
	): Promise<TOutput> {
		const { timeoutMs = 5000, fallback } = options;
		const requestId = String(Math.floor(Math.random() * 1000));

		return new Promise<TOutput>((resolve) => {
			const timer = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				resolve(fallback as TOutput);
			}, timeoutMs);

			this.pendingRequests.set(requestId, { resolve, timer });

			const req: CallbackPayload = { requestId, name, payload };
			emitNet(EVENT_NAMES.CLIENT_TO_SERVER_REQ, req);
		});
	}

	private listenForServerRequests(): void {
		onNet(EVENT_NAMES.SERVER_TO_CLIENT_REQ, async (req: CallbackPayload) => {
			const handler = this.handlers.get(req.name);

			if (!handler) {
				this.sendResponse({
					requestId: req.requestId,
					success: false,
					error: `Callback '${req.name}' not found on client.`,
				});
				return;
			}

			try {
				const result = await handler(req.payload);
				this.sendResponse({
					requestId: req.requestId,
					success: true,
					data: result,
				});
			} catch (err: any) {
				this.sendResponse({
					requestId: req.requestId,
					success: false,
					error: err?.message ?? 'Execution error.',
				});
			}
		});
	}

	private listenForServerResponses(): void {
		onNet(EVENT_NAMES.CLIENT_TO_SERVER_RES, (res: CallbackResponse) => {
			const pending = this.pendingRequests.get(res.requestId);
			if (!pending) return;

			clearTimeout(pending.timer);
			this.pendingRequests.delete(res.requestId);

			if (res.success) {
				pending.resolve(res.data);
			} else {
				// Returns fallback payload sent by server on permission refusal/error
				pending.resolve(res.data);
			}
		});
	}

	private sendResponse(res: CallbackResponse): void {
		emitNet(EVENT_NAMES.SERVER_TO_CLIENT_RES, res);
	}
}

export const ClientCallbacks = new ClientCallbackManager();
