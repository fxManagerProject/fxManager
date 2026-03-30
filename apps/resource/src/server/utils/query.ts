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
  showError: boolean = false,
): Promise<T> {
  const url = `http://${HOSTNAME}/internal${endpoint}`;

  try {
    const response = await fetch(url, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'x-resource-token': API_TOKEN,
        ...headers,
      },
      body: body ? JSON.stringify(body) : null,
    });

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
    if (showError) {
      console.error('QueryService Error:', err);
    } else {
      DEV: console.error('QueryService Error:', err, 'data:', {
        endpoint,
        method,
        body,
        headers,
        url,
      });
    }

    throw err;
  }
}
