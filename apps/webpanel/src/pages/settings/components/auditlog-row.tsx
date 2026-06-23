import { formatDate } from '@/lib/utils';
import type { AuditLog } from '@fxmanager/database/types';
import { Button } from '@fxmanager/ui/components/button';
import {
	ChevronDown,
	ChevronUp,
	Cog,
	FileQuestion,
	MessagesSquare,
	ScanEye,
	Server,
	Shield,
	Upload,
	User,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const ACTION_ICON_MAP: Record<
	string,
	React.ComponentType<{ className?: string }>
> = {
	server: Server,
	player: User,
	whitelist: ScanEye,
	admin: Shield,
	report: MessagesSquare,
	settings: Cog,
	migrate: Upload,
};

export function AuditLogRow({
	log,
	showAdmin,
}: {
	log: AuditLog;
	showAdmin?: boolean;
}) {
	const [isExpanded, setIsExpanded] = useState(false);

	const group = log.action.split('.')[0] || '';
	const ActionIcon = ACTION_ICON_MAP[group] || FileQuestion;

	const hasObjectData = log.metadata
		? Object.values(log.metadata).some(
				(val) => typeof val === 'object' && val !== null,
			)
		: false;

	const gridLayoutClass = showAdmin
		? 'grid-cols-[24px_1fr_180px_130px]'
		: 'grid-cols-[24px_1fr_130px]';

	return (
		<div
			className={`grid ${gridLayoutClass} items-start gap-4 py-3.5 px-2 hover:bg-muted/30 transition-colors border-b last:border-0`}
		>
			<ActionIcon className="h-4 w-4 text-muted-foreground/70 mt-1" />

			<div className="space-y-1.5 min-w-0">
				<div className="flex flex-wrap items-center gap-2">
					<span className="text-xs font-semibold uppercase tracking-wider text-foreground">
						{log.action.replace('_', ' ').replace('.', ': ')}
					</span>

					{log.player && (
						<span className="text-xs font-mono bg-muted border border-border/80 text-muted-foreground px-2 py-0.5 rounded">
							target: {log.player} (#{log.playerId})
						</span>
					)}
				</div>

				{log.metadata && Object.keys(log.metadata).length > 0 && (
					<div className="text-xs">
						{hasObjectData ? (
							<div className="space-y-2 mt-1">
								<Button
									type="button"
									variant="outline"
									onClick={() => setIsExpanded(!isExpanded)}
									className="h-6 gap-1.5 px-2 text-[11px] font-semibold cursor-pointer"
								>
									<span>{isExpanded ? 'Hide Metadata' : 'View Metadata'}</span>
									{isExpanded ? (
										<ChevronUp className="h-3 w-3 opacity-70" />
									) : (
										<ChevronDown className="h-3 w-3 opacity-70" />
									)}
								</Button>

								{isExpanded && (
									<div className="col-span-full flex flex-row w-full gap-4 bg-muted/30 border border-border/50 rounded-lg p-3 mt-1">
										{Object.entries(log.metadata).map(([key, val]) => (
											<div
												key={key}
												className="flex flex-col flex-1 gap-0.5 border-r border-border/40 last:border-0 pr-4 last:pr-0 pb-0"
											>
												<span className="font-semibold text-foreground/70 text-[11px] uppercase tracking-wider">
													{key}
												</span>
												<span className="font-mono text-muted-foreground text-xs">
													{typeof val === 'object' && val !== null ? (
														<ul className="space-y-1 list-disc pl-4 mt-1">
															{Object.entries(val).map(
																([nestedKey, nestedVal]) => (
																	<li
																		key={nestedKey}
																		className="text-muted-foreground/40"
																	>
																		<div className="inline-flex items-start gap-1 text-muted-foreground">
																			<span className="text-muted-foreground/70 font-semibold shrink-0">
																				{nestedKey}:
																			</span>
																			<span className="text-foreground">
																				{typeof nestedVal === 'object' &&
																				nestedVal !== null
																					? JSON.stringify(nestedVal)
																					: String(nestedVal)}
																			</span>
																		</div>
																	</li>
																),
															)}
														</ul>
													) : (
														String(val)
													)}
												</span>
											</div>
										))}
									</div>
								)}
							</div>
						) : (
							<div className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground/80 font-medium">
								{Object.entries(log.metadata).map(([key, val]) => (
									<span key={key} className="inline-block">
										<span className="text-muted-foreground/50">{key}:</span>{' '}
										{String(val)}
									</span>
								))}
							</div>
						)}
					</div>
				)}
			</div>

			{showAdmin && (
				<div className="text-sm mt-0.5">
					{log.adminId ? (
						<Link
							to={`/settings/admins/${log.adminId}`}
							className="inline-flex items-center text-xs font-medium text-primary-foreground hover:underline bg-primary/40 px-2.5 py-1 rounded-md border"
						>
							{log.admin ?? `Admin #${log.adminId}`}
						</Link>
					) : (
						<span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2.5 py-1 rounded-md border border-border">
							System
						</span>
					)}
				</div>
			)}

			<div className="text-right mt-1">
				<span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
					{formatDate(log.createdAt)}
				</span>
			</div>
		</div>
	);
}
