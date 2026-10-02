/**
 * NUI Request Callback Utility for CitizenFX / FiveM.
 *
 * Based on txAdmin's origin validation implementation:
 * @see {@link https://github.com/citizenfx/txAdmin/blob/master/resource/cl_main.lua#L195}
 */

const VALID_ORIGINS: readonly string[] = [
	'https://cfx-nui-fxManager',
	'https://fxManager',
] as const;

function isNuiRequestOriginValid(rawHeaders: unknown): boolean {
	if (!rawHeaders || typeof rawHeaders !== 'object') {
		return false;
	}

	const headers = rawHeaders as Record<string, unknown>;
	const origin = headers.Origin;

	$DEV: if (typeof origin === 'string' && origin === 'http://localhost:5175') return true;

	return typeof origin === 'string' && VALID_ORIGINS.includes(origin);
}

/**
 * Raw payload structure expected from FiveM's NUI HTTP pipeline.
 */
export interface RawNuiRequest {
	headers: Record<string, unknown>;
	body: string;
	[key: string]: unknown;
}

/**
 * Standard response shape returned to the raw NUI callback handler.
 */
export interface RawNuiResponse {
	status: number;
	body: string;
}

/**
 * Registers a type-safe NUI callback handler with origin validation.
 *
 * @template T - Input payload type parsed from JSON (defaults to `unknown`)
 * @template R - Response payload type (defaults to `Record<string, unknown>`)
 *
 * @param name - The name of the NUI callback event to listen for
 * @param cb - Handler function receiving parsed data and a response callback
 */
export function NuiCallback<T = unknown, R = Record<string, unknown>>(
	name: string,
	cb: (data: T, reply: (data: R) => void) => void,
): void {
	RegisterRawNuiCallback(
		name,
		(request: RawNuiRequest, rawCb: (response: RawNuiResponse) => void) => {
			if (!isNuiRequestOriginValid(request.headers)) {
				rawCb({
					status: 403,
					body: '{}',
				});
				return;
			}

			let parsedBody: T;
			try {
				parsedBody = JSON.parse(request.body) as T;
			} catch {
				parsedBody = request.body as unknown as T;
			}

			cb(parsedBody, (responseData: R) => {
				rawCb({
					status: 200,
					body:
						typeof responseData === 'object' && responseData !== null
							? JSON.stringify(responseData)
							: '{}',
				});
			});
		},
	);
}

let loaded = false;
NuiCallback('nuiloaded', (_, cb) => {
	if (!loaded) {
		emit('fxmanager:c2c:nuiloaded');
		loaded = true;
	}
	cb({});
});
