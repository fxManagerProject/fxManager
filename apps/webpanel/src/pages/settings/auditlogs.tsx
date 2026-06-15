import {
	Calendar as CalendarIcon,
	ChevronDown,
	ChevronsUpDown,
	ChevronUp,
	Cog,
	FileQuestion,
	Info,
	MessagesSquare,
	ScanEye,
	ScrollText,
	Server,
	Shield,
	User,
	X,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { Checkbox } from '@fxmanager/ui/components/checkbox';
import { formatDate } from '@/lib/utils';
import { useEffect, useState } from 'react';
import type { AuditLog } from '@fxmanager/database/types';
import { QueryService } from '@/lib/query';
import { Link } from 'react-router-dom';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import type { BaseAdminUser, PaginatedResponse } from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import { AUDIT_LOG_ACTIONS } from '@fxmanager/shared/constants';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@fxmanager/ui/components/popover';
import { Badge } from '@fxmanager/ui/components/badge';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@fxmanager/ui/components/command';
import { useDebounce } from '@/hooks/use-debounce';
import { Calendar } from '@fxmanager/ui/components/calendar';
import { format } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { toast } from 'sonner';

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
};

type AdminItem = { id: number; username: string };

function AuditLogRow({ log }: { log: AuditLog }) {
	const [isExpanded, setIsExpanded] = useState(false);

	const group = log.action.split('.')[0] || '';
	const ActionIcon = ACTION_ICON_MAP[group] || FileQuestion;

	const hasObjectData = log.metadata
		? Object.values(log.metadata).some(
				(val) => typeof val === 'object' && val !== null,
			)
		: false;

	return (
		<div className="grid grid-cols-[24px_1fr_180px_130px] items-start gap-4 py-3.5 px-2 hover:bg-muted/30 transition-colors border-b last:border-0">
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

			<div className="text-right mt-1">
				<span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
					{formatDate(log.createdAt)}
				</span>
			</div>
		</div>
	);
}

export default function AuditLogPage() {
	const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	const [selectedActions, setSelectedActions] = useState<string[]>([]);
	const [availableAdmins, setAvailableAdmins] = useState<AdminItem[]>([]);
	const [selectedAdmins, setSelectedAdmins] = useState<AdminItem[]>([]);
	const [isActionPopoverOpen, setIsActionPopoverOpen] = useState(false);
	const [isAdminPopoverOpen, setIsAdminPopoverOpen] = useState(false);

	const [target, setTarget] = useState('');
	const [admin, setAdmin] = useState('');
	const [page, setPage] = useState(1);

	const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);

	const debouncedTarget = useDebounce(target, 400);
	const debouncedadmin = useDebounce(admin, 400);

	useEffect(() => {
		setIsLoading(true);

		const params = new URLSearchParams({
			page: String(page),
			pageSize: '50',
			...(debouncedTarget.trim() && { target: debouncedTarget.trim() }),
		});

		if (selectedActions.length > 0) {
			selectedActions.forEach((act) => {
				params.append('action', act);
			});
		}

		if (selectedAdmins.length > 0) {
			selectedAdmins.forEach(({ id }) => {
				params.append('admin', id.toString());
			});
		}

		if (dateRange?.from) {
			params.append('dateFrom', dateRange.from.toISOString());
		}
		if (dateRange?.to) {
			params.append('dateTo', dateRange.to.toISOString());
		}

		QueryService<PaginatedResponse<AuditLog>>({
			endpoint: `/settings/audit?${params.toString()}`,
			method: 'GET',
		})
			.then((resp) => {
				setAuditLogs(resp.items || []);
			})
			.catch((err) => console.error(err))
			.finally(() => setIsLoading(false));
	}, [page, debouncedTarget, selectedActions, selectedAdmins, dateRange]);

	useEffect(() => {
		let cancelled = false;

		const params = new URLSearchParams({
			pageSize: '10',
		});

		if (debouncedadmin) params.set('search', debouncedadmin);

		QueryService<PaginatedResponse<BaseAdminUser>>({
			endpoint: `/settings/admins?${params.toString()}`,
			method: 'GET',
		})
			.then((response) => {
				if (cancelled) return;

				const { items } = response;

				setAvailableAdmins(
					items.map((i) => ({ id: i.id, username: i.username })),
				);
			})
			.catch((err) => {
				toast.error('Failed to search admins', {
					description: err.message,
				});
			});

		return () => {
			cancelled = true;
		};
	}, [debouncedadmin]);

	const toggleAction = (action: string) => {
		setPage(1);
		setSelectedActions((prev) =>
			prev.includes(action)
				? prev.filter((a) => a !== action)
				: [...prev, action],
		);
	};

	const toggleAdmin = (admin: AdminItem) => {
		setPage(1);
		setSelectedAdmins((prev) =>
			prev.includes(admin) ? prev.filter((a) => a !== admin) : [...prev, admin],
		);
	};

	return (
		<div className="flex h-[calc(100vh-2rem)] flex-col gap-6">
			<PageHeader
				Icon={ScrollText}
				title="Audit Logs"
				description="Audit log view for fxManager actions."
			/>

			<div className="flex flex-wrap justify-between items-end border-b border-border/60 pb-4">
				<div className="flex flex-wrap items-end gap-4">
					<div className="flex flex-col gap-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Search Target
						</Label>
						<Input
							type="text"
							placeholder="Username or ID..."
							value={target}
							onChange={(e) => {
								setTarget(e.target.value);
								setPage(1);
							}}
							className="h-9 w-60 bg-background"
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Admins
						</Label>
						<Popover
							open={isAdminPopoverOpen}
							onOpenChange={setIsAdminPopoverOpen}
						>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									role="combobox"
									className="h-9 min-w-[220px] max-w-[400px] justify-between text-left font-normal bg-background"
								>
									{selectedAdmins.length === 0 ? (
										<span className="text-muted-foreground">Any Admin</span>
									) : (
										<div className="flex flex-wrap gap-1 max-w-[340px] truncate">
											{selectedAdmins.map(({ id, username }) => (
												<Badge
													key={id}
													variant="secondary"
													className="text-[10px] px-1.5 py-0"
												>
													{username}
													<X
														className="ml-1 h-3 w-3 cursor-pointer text-muted-foreground/80 hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation();
															toggleAdmin({ id, username });
														}}
													/>
												</Badge>
											))}
										</div>
									)}
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[260px] p-0" align="start">
								<Command className="space-y-2">
									<CommandInput
										placeholder="Search admins..."
										value={admin}
										onValueChange={setAdmin}
									/>
									<CommandList>
										<CommandEmpty>No matching actions found.</CommandEmpty>
										{availableAdmins.map((admin) => {
											const isChecked = selectedAdmins.includes(admin);
											return (
												<CommandItem
													key={admin.id}
													onSelect={() => toggleAdmin(admin)}
													className="flex items-center gap-2 cursor-pointer"
												>
													<Checkbox
														checked={isChecked}
														onCheckedChange={() => {}}
													/>
													<span className="capitalize">{admin.username}</span>
												</CommandItem>
											);
										})}
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Action Type
						</Label>
						<Popover
							open={isActionPopoverOpen}
							onOpenChange={setIsActionPopoverOpen}
						>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									role="combobox"
									className="h-9 min-w-[220px] max-w-[400px] justify-between text-left font-normal bg-background"
								>
									{selectedActions.length === 0 ? (
										<span className="text-muted-foreground">All Actions</span>
									) : (
										<div className="flex flex-wrap gap-1 max-w-[340px] truncate">
											{selectedActions.map((act) => (
												<Badge
													key={act}
													variant="secondary"
													className="text-[10px] px-1.5 py-0"
												>
													{act.split('.')[1]}
													<X
														className="ml-1 h-3 w-3 cursor-pointer text-muted-foreground/80 hover:text-foreground"
														onClick={(e) => {
															e.stopPropagation();
															toggleAction(act);
														}}
													/>
												</Badge>
											))}
										</div>
									)}
									<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-[260px] p-0" align="start">
								<Command className="space-y-2">
									<CommandInput placeholder="Search actions..." />
									<CommandList>
										<CommandEmpty>No matching actions found.</CommandEmpty>
										{Object.entries(AUDIT_LOG_ACTIONS).map(
											([category, actions]) => (
												<CommandGroup key={category} heading={category}>
													{actions.map((act) => {
														const isChecked = selectedActions.includes(act);
														return (
															<CommandItem
																key={act}
																value={act}
																onSelect={() => toggleAction(act)}
																className="flex items-center gap-2 cursor-pointer"
															>
																<Checkbox
																	checked={isChecked}
																	onCheckedChange={() => {}}
																/>
																<span className="capitalize">
																	{act.split('.')[1].replace('_', ' ')}
																</span>
															</CommandItem>
														);
													})}
												</CommandGroup>
											),
										)}
									</CommandList>
								</Command>
							</PopoverContent>
						</Popover>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
							Date Range Filter
						</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									id="date"
									variant="outline"
									className="h-9 w-[260px] justify-start text-left font-normal bg-background"
								>
									<CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground/80" />
									{dateRange?.from ? (
										dateRange.to ? (
											<>
												{format(dateRange.from, 'LLL dd, yyyy')} -{' '}
												{format(dateRange.to, 'LLL dd, yyyy')}
											</>
										) : (
											format(dateRange.from, 'LLL dd, yyyy')
										)
									) : (
										<span className="text-muted-foreground">
											Pick a date range
										</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
								<Calendar
									mode="range"
									defaultMonth={dateRange?.from}
									selected={dateRange}
									onSelect={(range) => {
										setPage(1);
										setDateRange(range);
									}}
									numberOfMonths={2}
								/>
							</PopoverContent>
						</Popover>
					</div>
				</div>

				<Button
					onClick={() => {
						setTarget('');
						setSelectedActions([]);
						setSelectedAdmins([]);
						setDateRange(undefined);
						setPage(1);
					}}
					className="h-9 px-3 text-xs font-medium"
					variant="outline"
				>
					Clear Filters
				</Button>
			</div>

			<ScrollArea className="flex-1 min-h-0 border rounded bg-card/50 p-2 pr-4">
				{isLoading ? (
					<div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
						Loading activity logs...
					</div>
				) : auditLogs.length > 0 ? (
					<div className="divide-y divide-border">
						{/* Fix: Cleaned up the nested mapping issue completely */}
						{auditLogs.map((log) => (
							<AuditLogRow key={log.id} log={log} />
						))}
					</div>
				) : (
					<div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-xl bg-muted/20">
						<Info className="h-10 w-10 text-muted-foreground/40 mb-3" />
						<p className="text-sm font-semibold text-muted-foreground">
							No recent activity logs
						</p>
						<p className="text-xs text-muted-foreground/60 mt-0.5">
							It's squeaky clean.
						</p>
					</div>
				)}
			</ScrollArea>
		</div>
	);
}
