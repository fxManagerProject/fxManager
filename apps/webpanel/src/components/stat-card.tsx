import { Card, CardContent } from '@fxmanager/ui/components/card';
import { cn } from '@fxmanager/ui/lib/utils';

export function StatCard({
	icon: Icon,
	label,
	value,
	className,
}: {
	icon: React.ElementType;
	label: string;
	value: React.ReactNode;
	className?: string;
}) {
	return (
		<Card className={cn('flex-1 justify-center min-w-[140px]', className)}>
			<CardContent className="py-1 flex items-center hj gap-3">
				<div className="rounded-md bg-muted p-2 shrink-0">
					<Icon className="h-4 w-4 text-muted-foreground" />
				</div>
				<div className="overflow-hidden flex-1">
					<p className="text-xs text-muted-foreground truncate">{label}</p>
					<p className="text-sm font-semibold truncate">{value}</p>
				</div>
			</CardContent>
		</Card>
	);
}
