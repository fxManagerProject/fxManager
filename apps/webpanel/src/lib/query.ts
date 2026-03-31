import { ApiError } from '@fxmanager/shared/types';
import { toast } from 'sonner';

const HOSTNAME = import.meta.env.DEV ? 'localhost:3000' : window.location.host;
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
	// const protocol = IS_SECURE ? 'https' : 'http';
	// const url = `${protocol}://${HOSTNAME}/api${endpoint}`;
	const url = `/api${endpoint}`;

	try {
		console.log('fetch request', {
			method,
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
			body: body ? JSON.stringify(body) : null,
		});
		const response = await fetch(url, {
			method,
			credentials: 'include',
			headers: {
				'Content-Type': 'application/json',
				...headers,
			},
			body: body ? JSON.stringify(body) : null,
		});

		if (!response.ok) {
			let errorData;
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

export function WSUrl(endpoint: string = '/ws') {
  const protocol = IS_SECURE ? 'wss' : 'ws';
  const host = window.location.host;
  return `${protocol}://${host}${endpoint}`;
}
