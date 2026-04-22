export const STATUS_VARIANT: Record<
	string,
	| 'success'
	| 'destructive'
	| 'secondary'
	| 'warning'
	| 'link'
	| 'default'
	| 'outline'
	| 'ghost'
> = {
	running: 'success',
	crashed: 'destructive',
	starting: 'warning',
	stopping: 'warning',
	stopped: 'secondary',
};
