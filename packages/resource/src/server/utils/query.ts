import { ApiError } from '@fxmanager/types';

const API_TOKEN = GetConvar('resource-api-token', '');
const PORT = GetConvarInt('api-port', 4005);
const HOSTNAME = `localhost:${PORT}`;

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuidV4Regex.test(API_TOKEN)) throw new Error('An invalid api token was loaded !');

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
  const url = `http://${HOSTNAME}${endpoint}`;

  try {
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
      DEV: console.error('QueryService Error:', err);
    }

    throw err;
  }
}
