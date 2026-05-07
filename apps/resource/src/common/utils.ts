import { ResourceName, IsBrowser } from './resource';

// credit ox_lib
// licensed under LGPL-V3
// https://github.com/overextended/ox_lib/blob/main/package/shared/index.ts#L12-L14
export function sleep(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms, null));
}

export function LoadFile(path: string) {
	return LoadResourceFile(ResourceName, path);
}

export function LoadJsonFile<T = unknown>(path: string): T {
	if (!IsBrowser) return JSON.parse(LoadFile(path)) as T;

	const resp = fetch(`/${path}`, {
		method: 'post',
		headers: {
			'Content-Type': 'application/json; charset=UTF-8',
		},
	});

	return resp.then((response) => response.json()) as T;
}
