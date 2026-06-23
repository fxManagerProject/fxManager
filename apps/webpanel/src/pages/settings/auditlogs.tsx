import {
	Calendar as CalendarIcon,
	ChevronsUpDown,
	Info,
	ScrollText,
	X,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { Checkbox } from '@fxmanager/ui/components/checkbox';
import { useEffect, useState } from 'react';
import type { AuditLog } from '@fxmanager/database/types';
import { QueryService } from '@/lib/query';
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
import { AuditLogRow } from './components/auditlog-row';

type AdminItem = { id: number; username: string };

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
						{auditLogs.map((log) => (
							<AuditLogRow key={log.id} log={log} showAdmin />
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
