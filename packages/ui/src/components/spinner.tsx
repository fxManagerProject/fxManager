import { cn } from '@fxmanager/ui/lib/utils';
import { Loader2Icon, type LucideProps } from 'lucide-react';

function Spinner({ className, ...props }: LucideProps) {
	return (
		<Loader2Icon
			role="status"
			aria-label="Loading"
			className={cn('size-4 animate-spin', className)}
			{...props}
		/>
	);
}

export { Spinner };
