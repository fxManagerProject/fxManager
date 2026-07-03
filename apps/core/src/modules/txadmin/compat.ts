import type { TxEventName, TxEventPayloads } from '@fxmanager/shared/types';
import { getServerNetEndpoint } from '../../common/fxserver-endpoint';
import { ConfigManager } from '../config/manager';

export class TxAdminCompat {
	async emit<E extends TxEventName>(
		event: E,
		data: TxEventPayloads[E],
	): Promise<void> {
		try {
			const { resourceApiToken } =
				ConfigManager.getInstance().getSystemValues();
			const endpoint = await getServerNetEndpoint();

			const response = await fetch(
				`http://${endpoint}/fxManager/txadmin/event`,
				{
					method: 'POST',
					body: JSON.stringify({ event, data }),
					headers: {
						Application: 'json/application',
						'x-resource-token': resourceApiToken,
					},
				},
			);

			if (!response.ok) {
				console.error(
					`[txAdminCompat] resource rejected '${event}': ${response.status} ${response.statusText}`,
				);
			}
		} catch (err) {
			console.error(
				`[txAdminCompat] failed to relay '${event}':`,
				(err as Error).message,
			);
		}
	}
}

export const txAdminCompat = new TxAdminCompat();
