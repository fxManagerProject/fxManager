import { PERMISSION_LABELS } from '@fxmanager/shared/constants';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { ShieldCheck } from 'lucide-react';

interface PermissionGridProps {
	bitfield: number;
	editable: boolean;
	onToggle: (bit: number) => void;
}

export function PermissionGrid({
	bitfield,
	editable,
	onToggle,
}: PermissionGridProps) {
	const hasPermission = (bit: number) => (bitfield & bit) !== 0;

	return (
		<ScrollArea className="flex-1 border rounded-xl bg-muted/5 overflow-y-auto">
			<div className="p-4 pr-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
				{Object.entries(PERMISSION_LABELS).map(([bitStr, info]) => {
					const bit = parseInt(bitStr, 10);
					const active = hasPermission(bit);

					return (
						<button
							key={bit}
							disabled={!editable}
							onClick={() => onToggle(bit)}
							type="button"
							className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-all ${
								active
									? 'border-primary bg-primary/5 ring-1 ring-primary'
									: 'border-transparent bg-muted/40 hover:bg-muted disabled:hover:bg-muted/40'
							}`}
						>
							<div
								className={`mt-0.5 rounded-md p-1 ${active ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
							>
								<ShieldCheck className="h-4 w-4" />
							</div>
							<div>
								<p className="text-sm font-bold">{info.label}</p>
								<p className="text-xs text-muted-foreground">{info.desc}</p>
							</div>
						</button>
					);
				})}
			</div>
		</ScrollArea>
	);
}
