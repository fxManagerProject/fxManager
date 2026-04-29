import fetch from 'node-fetch';
import { ApiError } from '@fxmanager/shared/types';
import { API_TOKEN, HOSTNAME } from './env';

export async function QueryManager<T>(
	{
		endpoint,
		method,
		body = null,
		headers = {},
	}: {
		endpoint: string;
		method: 'GET' | 'POST';
		body?: unknown;
		headers?: Record<string, string>;
	},
	external: boolean = false,
): Promise<T> {
	const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
	const url = `http://${HOSTNAME}${external ? '' : '/internal'}${cleanEndpoint}`;

	try {
		// biome-ignore lint/suspicious/noExplicitAny: needed
		const options: any = {
			method,
			headers: {
				'Content-Type': 'application/json',
				'x-resource-token': API_TOKEN,
				...headers,
			},
		};

		if (method !== 'GET') {
			options.body = body ? JSON.stringify(body) : JSON.stringify({});
		}

		const response = await fetch(url, options);

		if (!response.ok) {
			let errorData: { message: string };
			try {
				errorData = (await response.json()) as { message: string };
			} catch {
				errorData = { message: response.statusText };
			}

			throw new ApiError(
				errorData.message || `Request failed with status ${response.status}`,
				response.status,
				errorData,
			);
		}

		return (await response.json()) as T;
	} catch (err) {
		console.error('QueryService Error:', err);

		throw err;
	}
}
