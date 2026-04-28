// import { ApiError } from '@fxmanager/shared/types';
// import { QueryManager } from '../utils/query';

// const HOSTNAME = '127.0.0.1:3000';
// // make sure to hardocde it in the @fxManager/core/common/config file
// const API_TOKEN = '0049b417-5251-43c2-aa7d-4e54e3e584a3';

// async function QueryManager<T>(
// 	{
// 		endpoint,
// 		method,
// 		body = null,
// 		headers = {},
// 	}: {
// 		endpoint: string;
// 		method: 'GET' | 'POST';
// 		body?: unknown;
// 		headers?: Record<string, string>;
// 	},
// 	external: boolean = false,
// 	showError: boolean = false,
// ): Promise<T> {
// 	const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
// 	const url = `http://${HOSTNAME}${external ? '' : '/internal'}${cleanEndpoint}`;

// 	try {
// 		const options: RequestInit = {
// 			method,
// 			headers: {
// 				'Content-Type': 'application/json',
// 				'x-resource-token': API_TOKEN,
// 				...headers,
// 			},
// 		};

// 		if (method !== 'GET') {
// 			options.body = body ? JSON.stringify(body) : JSON.stringify({});
// 		}

// 		console.log('fetch req on', url, options.method);
// 		const response = await fetch(url, options);
// 		console.log('fetch req response', response);

// 		if (!response.ok) {
// 			let errorData: { message: string };
// 			try {
// 				errorData = (await response.json()) as { message: string };
// 			} catch {
// 				errorData = { message: response.statusText };
// 			}

// 			throw new ApiError(
// 				errorData.message || `Request failed with status ${response.status}`,
// 				response.status,
// 				errorData,
// 			);
// 		}

// 		return (await response.json()) as T;
// 	} catch (err) {
// 		console.error('QueryService Error:', err);

// 		throw err;
// 	}
// }

// region general query manager test

// setTimeout(() => {
// 	// console.log('1. Testing api/health endpoint')
// 	// QueryManager({ endpoint: 'api/health', method: 'GET' })
// 	//   .then(r => console.log('1. test fetch response', JSON.stringify(r)))
// 	//   .catch(err => console.error('1. test fetch failed', err));

// 	const _fetchy = async (url: string) => {
// 		console.log('Running fetchy', url);
// 		const r = await fetch(url);
// 		console.log('Finished with fetchy', url, JSON.stringify(r), await r.json());
// 	};

// 	_fetchy('http://127.0.0.1:3000/api/health');
// 	// _fetchy('https://jsonplaceholder.typicode.com/posts/1');

// 	(async () => {
// 		try {
// 			console.log(
// 				'1. Success:',
// 				await QueryManager({ endpoint: 'api/health', method: 'GET' }, true),
// 			);
// 		} catch (err) {
// 			console.error('1. Failed:', (err as Error).message);
// 		}
// 	})();

// 	(async () => {
// 		try {
// 			console.log(
// 				'2. Success:',
// 				await QueryManager({
// 					endpoint: '/players/deferrals',
// 					method: 'POST',
// 					body: {
// 						identifiers: {
// 							license: 'license:80c583a09ed49bf8e22117f0253a0fa1fc106cd9',
// 						},
// 					},
// 				}),
// 			);
// 		} catch (err) {
// 			console.error('2. Failed:', (err as Error).message);
// 		}
// 	})();
// }, 1_000);

// region ts PerformHttpRequest

// // A registry to store callbacks indexed by the request ID
// // const httpDispatch: Map<number, (status: number, data: string | null, headers: Record<string, string>, error?: string) => void> = new Map();

// // /**
// //  * Re-implementation of the FiveM Lua PerformHttpRequest in TypeScript
// //  */
// // export function PerformHttpRequest(
// //     url: string,
// //     cb: (status: number, data: string | null, headers: Record<string, string>, error?: string) => void,
// //     method: string = 'GET',
// //     data: any = '',
// //     headers: Record<string, string> = {},
// //     options?: { followLocation?: boolean }
// // ): void {
// //     // Default followLocation to true unless explicitly disabled
// //     const followLocation = options?.followLocation !== undefined ? options.followLocation : true;

// //     const requestData = {
// //         url: url,
// //         method: method,
// //         data: typeof data === 'object' ? JSON.stringify(data) : data,
// //         headers: headers,
// //         followLocation: followLocation
// //     };

// //     // Call the internal native
// //     const id = PerformHttpRequestInternalEx(requestData);

// //     if (id !== -1) {
// //         // Store the callback to be executed when the event fires
// //         console.log('http req id', id);
// //         httpDispatch.set(id, cb);
// //     } else {
// //         // Immediate failure if the engine couldn't initialize the request
// //         cb(0, null, {}, 'Failure handling HTTP request');
// //     }
// // }

// // /**
// //  * The Event Listener that hooks into the Cfx response system
// //  */
// // on('__cfx_async_http_response', (id: number, status: number, data: string, headers: Record<string, string>) => {
// //     const cb = httpDispatch.get(id);
// //     console.log('__cfx_async_http_response id:', id);

// //     if (cb) {
// //         cb(status, data, headers);
// //         // Always delete after execution to prevent memory leaks
// //         httpDispatch.delete(id);
// //     }
// // });

// // console.log('Running custom PerformHttpRequest')
// // PerformHttpRequest('http://192.168.1.12:3000/api/health', (status, data, headers) => {
// //   console.log('response from http://192.168.1.12:3000/api/health', JSON.stringify({ status, data, headers}));
// // }, 'GET', {});

// region player join/update query

// const name = 'MaximusPrime';
// const serverId = 1;

// const body = {
//   name,
//   identifiers: {
//     license: 'license:80c583a09ed49bf8e22117f0253a0fa1fc106cd9'
//   },
//   serverId,
// } satisfies {
//   name: string;
//   identifiers: PlayerIdentifiers;
//   serverId: number;
// };

// try {
//   const r = await QueryManager<{ ack: true }>({
//     endpoint: '/players/join',
//     method: 'POST',
//     body,
//   });
//   console.log('[fake join] response', r)
// } catch (err) {
//   console.error(
//     `[API Error] Failed to process join for ${name} (${serverId}):`,
//     (err as Error).message,
//   );
// }

// const updatePacket = {
//   [`${serverId}`]: [150, 24],
// } as PlayerUpdatePackage;

// try {
//   const r = await QueryManager({
//     endpoint: '/players/update',
//     method: 'POST',
//     body: { payload: updatePacket },
//   });
//   console.log('[fake join] response', r)
// } catch (err) {
//   console.error(
//     `[API Error] Failed to process join for ${name} (${serverId}):`,
//     (err as Error).message,
//   );
// }
