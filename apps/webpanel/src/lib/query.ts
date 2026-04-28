import { ApiError } from '@fxmanager/shared/types';
import { toast } from 'sonner';

const IS_SECURE = window.location.protocol === 'https:';

export async function QueryService<T>(
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
	showError: boolean = false,
): Promise<T> {
	const url = `/api${endpoint}`;

	const options: RequestInit = {
		method,
		credentials: 'include',
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
	};

	if (method !== 'GET') {
		options.body = body ? JSON.stringify(body) : JSON.stringify({});
	}

	try {
		// console.log('fetch request', options);
		const response = await fetch(url, options);

		if (!response.ok) {
			let errorData: { message: string };
			try {
				errorData = await response.json();
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
		if (showError || import.meta.env.DEV)
			console.error('QueryService Error:', err);
		throw err;
	}
}

export async function HandleServerAction(action: 'start' | 'stop' | 'restart') {
	try {
		await QueryService({
			endpoint: `/server/${action}`,
			method: 'POST',
		});
	} catch (err) {
		console.error(`Unable to execute action ${action}`, (err as Error).message);
		toast.error(`Unable to ${action} on server`, {
			richColors: true,
			position: 'top-center',
		});
	}
}

export function WSUrl() {
	const protocol = IS_SECURE ? 'wss' : 'ws';
	const host = window.location.host;
	return `${protocol}://${host}/api/ws`;
}
