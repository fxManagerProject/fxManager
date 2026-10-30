import { ApiError } from '@fxmanager/shared/types';

/** Keep HTML fallbacks and proxy errors out of JSON parsing and user-facing errors. */
export async function readApiResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers
		.get('content-type')
		?.split(';')[0]
		?.trim()
		.toLowerCase();
	if (contentType !== 'application/json' && !contentType?.endsWith('+json')) {
		throw new ApiError(
			'The API returned a non-JSON response. Restart the updated core and check that the panel API proxy points to it.',
			response.ok ? 502 : response.status,
		);
	}
	let data: unknown;
	try {
		data = await response.json();
	} catch {
		throw new ApiError(
			'The API returned invalid JSON. Please retry or check the core logs.',
			response.ok ? 502 : response.status,
		);
	}
	if (!response.ok) {
		const body =
			typeof data === 'object' && data !== null
				? (data as Record<string, unknown>)
				: {};
		const message =
			typeof body.message === 'string'
				? body.message
				: typeof body.error === 'string'
					? body.error
					: `Request failed with status ${response.status}`;
		throw new ApiError(message, response.status, data);
	}
	return data as T;
}
