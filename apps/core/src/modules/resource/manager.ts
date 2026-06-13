import type {
	ApiResponse,
	ResourceData,
	ResourceInitialData,
} from '@fxmanager/shared/types';
import { wsManager } from '../ws/manager';
import { ConfigManager } from '../config/manager';

class ResourceManager {
	private config = ConfigManager.getInstance();
	private available: boolean | 'errored' = false;
	private resourcelist: ResourceData[] = [];

	constructor() {}

	private getApiToken() {
		const { resourceApiToken } = this.config.getSystemValues();
		return resourceApiToken;
	}

	async loadResources(): Promise<void> {
		try {
			const apiToken = this.getApiToken();
			const response = await fetch(
				'http://localhost:30120/fxManager/resources/load',
				{
					method: 'GET',
					headers: {
						Application: 'json/application',
						'x-resource-token': apiToken,
					},
				},
			);

			if (!response.ok) {
				throw new Error(
					`Server responded with ${response.status}: ${response.statusText}`,
				);
			}

			const result = (await response.json()) as ApiResponse<ResourceData[]>;

			if (result.success) {
				this.resourcelist = result.data;
				this.available = true;

				this.sendWsUpdate();
			} else {
				this.available = 'errored';
				console.error(
					`[loadResources] Failed to load resource list: ${result.error}`,
				);
			}
		} catch (err) {
			this.available = 'errored';
			console.error(
				`[loadResources] Failed to load resources: ${(err as Error).message}`,
			);
		}
	}

	stoppingServer() {
		this.resourcelist = this.resourcelist.map((res) => ({
			...res,
			status: 'stopped',
		}));
		this.available = false;

		this.sendWsUpdate();
	}

	sendWsUpdate() {
		wsManager.broadcast<ResourceInitialData>({
			channel: 'resourcelist',
			event: 'refresh',
			data: {
				status: this.available,
				resourcelist: this.resourcelist,
			},
		});
	}

	getResourceList(): ResourceInitialData {
		return { status: this.available, resourcelist: this.resourcelist };
	}

	handleResourceUpdate(
		payload:
			| { event: 'update'; data: ResourceData }
			| { event: 'refresh'; data: ResourceData[] },
	) {
		if (payload.event === 'update') {
			const idx = this.resourcelist.findIndex(
				(res) => res.name === payload.data.name,
			);

			if (idx < 0) {
				this.resourcelist.push(payload.data);
			} else {
				this.resourcelist[idx] = {
					...this.resourcelist[idx],
					...payload.data,
				};
			}

			wsManager.broadcast<ResourceData>({
				channel: 'resourcelist',
				event: payload.event,
				data: payload.data,
			});
		} else {
			this.resourcelist = payload.data;

			wsManager.broadcast<ResourceInitialData>({
				channel: 'resourcelist',
				event: payload.event,
				data: {
					status: this.available,
					resourcelist: payload.data,
				},
			});
		}
	}
}

export const resourceManager = new ResourceManager();
