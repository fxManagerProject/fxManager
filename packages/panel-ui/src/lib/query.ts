const HOSTNAME = process.env.NODE_ENV === 'development'
    ? 'localhost:4000'
    : window.location.host;
const IS_SECURE = window.location.protocol === 'https:';

export async function QueryService({ endpoint, method, body = null, headers = {} }: {
    endpoint: string;
    method: 'GET' | 'POST';
    body?: unknown;
    headers?: Record<string, string>;
}) {
    const protocol = IS_SECURE ? 'https' : 'http';
    const url = `${protocol}://${HOSTNAME}${endpoint}`;

    try {
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...headers,
            },
            body: body ? JSON.stringify(body) : null,
        });

        if (!response.ok) {
            throw new Error(`Error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    } catch (err) {
        console.error("QueryService Error:", err);
        throw err;
    }
}

export function WSUrl(endpoint: string = '/ws') {
    const protocol = IS_SECURE ? 'wss' : 'ws';
    return `${protocol}://${HOSTNAME}${endpoint}`;
}