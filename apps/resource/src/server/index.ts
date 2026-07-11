import './txadmin';
import './events';
import './httphandler';
import './exports';
import { censorConvars } from './utils/env';
import { QueryManager } from './utils/query';

censorConvars();

setTimeout(() => {
	console.log('^2Server initialized^7');

	QueryManager({
		endpoint: '/server/ready',
		method: 'POST',
		body: {},
	});
}, 0);
