import {
	type CallbackPayload,
	type CallbackResponse,
	type UserPermissionKey,
	EVENT_NAMES,
	hasPermission,
} from '@common/types';

type ServerCallbackHandler<TInput, TOutput> = (
	source: number,
	data: TInput,
) => TOutput | Promise<TOutput>;

interface ServerCallbackRegistration<TInput = any, TOutput = any> {
	handler: ServerCallbackHandler<TInput, TOutput>;
	permission?: UserPermissionKey;
	fallback?: TOutput;
}

export class ServerCallbackManager {
	private handlers = new Map<string, ServerCallbackRegistration>();
	private pendingRequests = new Map<
		string,
		{ resolve: (val: any) => void; timer: CitizenTimer }
	>();

	constructor() {
		this.listenForClientRequests();
		this.listenForClientResponses();
	}

	/**
	 * Register a callback that clients can invoke.
	 */
	register<TInput = any, TOutput = any>(
		name: string,
		handler: ServerCallbackHandler<TInput, TOutput>,
		options?: {
			requiredPermission?: UserPermissionKey;
			fallback?: TOutput;
		},
	): void {
		this.handlers.set(name, {
			handler,
			requiredPermission: options?.requiredPermission,
			fallback: options?.fallback,
		});
	}

	/**
	 * Trigger a callback on a target client and await the response.
	 */
	async trigger<TOutput = any, TInput = any>(
		targetSource: number,
		name: string,
		payload: TInput,
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

			const req: CallbackPayload<TInput> = { requestId, name, payload };
			emitNet(EVENT_NAMES.SERVER_TO_CLIENT_REQ, targetSource, req);
		});
	}

	private listenForClientRequests(): void {
		onNet(EVENT_NAMES.CLIENT_TO_SERVER_REQ, async (req: CallbackPayload) => {
			const src = globalThis.source;
			const registration = this.handlers.get(req.name);

			if (!registration) {
				this.sendResponse(src, {
					requestId: req.requestId,
					success: false,
					error: `Callback '${req.name}' is not registered.`,
				});
				return;
			}

			const { handler, requiredPermission, fallback } = registration;

			// Permission Enforcement
			if (requiredPermission && !hasPermission(src, requiredPermission)) {
				this.sendResponse(src, {
					requestId: req.requestId,
					success: false,
					data: fallback,
					error: `Permission denied: Requires ${requiredPermission}`,
				});
				return;
			}

			try {
				const result = await handler(src, req.payload);
				this.sendResponse(src, {
					requestId: req.requestId,
					success: true,
					data: result,
				});
			} catch (err: any) {
				this.sendResponse(src, {
					requestId: req.requestId,
					success: false,
					data: fallback,
					error: err?.message ?? 'Execution error during callback process.',
				});
			}
		});
	}

	private listenForClientResponses(): void {
		onNet(EVENT_NAMES.SERVER_TO_CLIENT_RES, (res: CallbackResponse) => {
			const pending = this.pendingRequests.get(res.requestId);
			if (!pending) return;

			clearTimeout(pending.timer);
			this.pendingRequests.delete(res.requestId);

			pending.resolve(res.success ? res.data : undefined);
		});
	}

	private sendResponse(targetSource: number, res: CallbackResponse): void {
		emitNet(EVENT_NAMES.CLIENT_TO_SERVER_RES, targetSource, res);
	}
}

export const ServerCallbacks = new ServerCallbackManager();
