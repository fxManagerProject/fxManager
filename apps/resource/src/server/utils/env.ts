const API_TOKEN = GetConvar('resource-api-token', '');
const PORT = GetConvarInt('api-port', 4005);
const HOSTNAME = `localhost:${PORT}`;

const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuidV4Regex.test(API_TOKEN)) throw new Error('An invalid api token was loaded !');

export { API_TOKEN, PORT, HOSTNAME };
