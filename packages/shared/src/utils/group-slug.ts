export function slugifyGroupName(name: string): string {
	if (typeof name !== 'string') return '';
	return name
		.toLowerCase()
		.trim()
		.replace(/[\s-]+/g, '_')
		.replace(/[^a-z0-9_]/g, '')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
}
