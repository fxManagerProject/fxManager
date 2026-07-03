const RESOURCE_NAME_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

export function isValidResourceName(name: string): boolean {
	if (typeof name !== 'string') return false;
	return RESOURCE_NAME_PATTERN.test(name);
}
