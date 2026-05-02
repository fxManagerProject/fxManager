import { QueryManager } from '../utils/query';
import { getResourcesData } from '../utils/resources';

on('onResourceStart', async (resource: string) => {
	try {
		const body = getResourcesData(resource);

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

on('onResourceStopped', async (resource: string) => {
	try {
		const body = getResourcesData(resource);

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
