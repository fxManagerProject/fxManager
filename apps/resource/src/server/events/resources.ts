import { QueryManager } from '../utils/query';
import { getResourcesData } from '../utils/resources';
import { sleep } from '@common/utils';

on('onResourceStart', async (resource: string) => {
	try {
		await sleep(100);
		const body = getResourcesData(resource);

		if (!body) return;

		await QueryManager({
			endpoint: 'resources/update',
			method: 'POST',
			body,
		});
	} catch (err) {
		console.error(
			`Unable to update resource ${resource}:`,
			(err as Error).message,
		);
	}
});

on('onResourceStop', async (resource: string) => {
	try {
		await sleep(100);
		const body = getResourcesData(resource);

		if (!body) return;

		await QueryManager({
			endpoint: 'resources/update',
			method: 'POST',
			body,
		});
	} catch (err) {
		console.error(
			`Unable to update resource ${resource}:`,
			(err as Error).message,
		);
	}
});
