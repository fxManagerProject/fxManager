import {
	type CallbackPayload,
	type CallbackResponse,
	type UserPermissionKey,
	EVENT_NAMES,
} from '@common/types';
import {
	ACE_PREFIX,
	PERMISSION_ACE_KEYS,
	UserPermissions,
} from '@fxmanager/shared/constants';

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
	private requestSequence = 0;
	private traffic = new Map<
		number,
		{ start: number; count: number; pending: number }
	>();
	private handlers = new Map<string, ServerCallbackRegistration>();
	private pendingRequests = new Map<
		string,
		{ resolve: (val: any) => void; timer: CitizenTimer; targetSource: number }
	>();

	constructor() {
		this.listenForClientRequests();
		this.listenForClientResponses();
		on('playerDropped', () => this.traffic.delete(Number(globalThis.source)));
	}

	private hasPermission(
		src: number | string,
		permKey: UserPermissionKey,
	): boolean {
		const bit = UserPermissions[permKey];
		if (!bit || bit === UserPermissions.NONE) return false;

		// Check master override or specific ACE key
		if (IsPlayerAceAllowed(String(src), ACE_PREFIX)) return true;

		const aceSuffix = PERMISSION_ACE_KEYS[bit];
		if (!aceSuffix) return false;

		return IsPlayerAceAllowed(String(src), `${ACE_PREFIX}.${aceSuffix}`);
	}

	/**
	 * Register a callback that clients can invoke.
	 */
	register<TInput = any, TOutput = any>(
		name: string,
		handler: ServerCallbackHandler<TInput, TOutput>,
		options?: {
			permission?: UserPermissionKey;
			fallback?: TOutput;
		},
	): void {
		this.handlers.set(name, {
			handler,
			permission: options?.permission,
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
		const requestId = String(++this.requestSequence);

		return new Promise<TOutput>((resolve) => {
			const timer = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				resolve(fallback as TOutput);
			}, timeoutMs);

			this.pendingRequests.set(requestId, { resolve, timer, targetSource });

			const req: CallbackPayload<TInput> = { requestId, name, payload };
			emitNet(EVENT_NAMES.SERVER_TO_CLIENT_REQ, targetSource, req);
		});
	}

	private listenForClientRequests(): void {
		onNet(EVENT_NAMES.CLIENT_TO_SERVER_REQ, async (req: CallbackPayload) => {
			const src = Number(globalThis.source);
			if (
				!Number.isSafeInteger(src) ||
				src < 1 ||
				!req ||
				typeof req !== 'object' ||
				typeof req.name !== 'string' ||
				req.name.length > 100 ||
				typeof req.requestId !== 'string' ||
				req.requestId.length > 100
			)
				return;
			const license = GetPlayerIdentifierByType(String(src), 'license');
			const session = this.traffic.get(src) ?? {
				start: Date.now(),
				count: 0,
				pending: 0,
			};
			this.traffic.set(src, session);
			if (Date.now() - session.start >= 1000) {
				session.start = Date.now();
				session.count = 0;
			}
			if (++session.count > 30 || session.pending >= 8) return;
			const registration = this.handlers.get(req.name);

			if (!registration) {
				this.sendResponse(src, {
					requestId: req.requestId,
					success: false,
					error: `Callback '${req.name}' is not registered.`,
				});
				return;
			}

			const { handler, permission, fallback } = registration;

			// Permission Enforcement
			if (permission && !this.hasPermission(src, permission)) {
				this.sendResponse(src, {
					requestId: req.requestId,
					success: false,
					data: fallback,
					error: `Permission denied: Requires ${permission}`,
				});
				return;
			}

			session.pending++;
			try {
				const result = await handler(src, req.payload);
				if (
					this.traffic.get(src) !== session ||
					GetPlayerIdentifierByType(String(src), 'license') !== license
				)
					return;
				this.sendResponse(src, {
					requestId: req.requestId,
					success: true,
					data: result,
				});
			} catch (err: any) {
				if (
					this.traffic.get(src) !== session ||
					GetPlayerIdentifierByType(String(src), 'license') !== license
				)
					return;
				this.sendResponse(src, {
					requestId: req.requestId,
					success: false,
					data: fallback,
					error: err?.message ?? 'Execution error during callback process.',
				});
			} finally {
				session.pending--;
			}
		});
	}

	private listenForClientResponses(): void {
		onNet(EVENT_NAMES.SERVER_TO_CLIENT_RES, (res: CallbackResponse) => {
			if (!res || typeof res !== 'object' || typeof res.requestId !== 'string')
				return;
			const pending = this.pendingRequests.get(res.requestId);
			if (!pending || pending.targetSource !== Number(globalThis.source))
				return;

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
