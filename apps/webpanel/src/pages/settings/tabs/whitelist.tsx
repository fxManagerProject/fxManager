import { QueryService } from '@/lib/query';
import { Button } from '@fxmanager/ui/components/button';

export default function GeneralTab() {
	async function testQuery() {
		const response = await QueryService({
			endpoint: '/settings?scope=general',
			method: 'GET',
		});

		console.log(response);
	}

	return <Button onClick={testQuery}>Test Query</Button>;
}
