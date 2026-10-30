import type { IncidentEvent, IncidentEventKind } from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import { Badge } from '@fxmanager/ui/components/badge';
import { Card } from '@fxmanager/ui/components/card';
import { Label } from '@fxmanager/ui/components/label';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@fxmanager/ui/components/collapsible';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@fxmanager/ui/components/popover';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import { Calendar } from '@fxmanager/ui/components/calendar';
import {
	CalendarDays,
	ChevronRight,
	Clock3,
	Terminal,
	Activity,
	Server,
	Package,
	FileCog,
	Unplug,
	TriangleAlert,
	Search,
} from 'lucide-react';
import { localTime, dateText } from './time';

export const EVENT_LABELS: Record<IncidentEventKind, string> = {
	console: 'Console',
	server: 'Server',
	resource: 'Resources',
	config: 'Configuration',
	performance: 'Performance',
	disconnect: 'Disconnects',
	gap: 'Missing events',
};
const EVENT_ICONS = {
	console: Terminal,
	server: Server,
	resource: Package,
	config: FileCog,
	performance: Activity,
	disconnect: Unplug,
	gap: TriangleAlert,
};
const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) =>
	String(i).padStart(2, '0'),
);
const clockTime = (ts: number) =>
	new Date(ts).toLocaleTimeString([], {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	});

export function DateTimeField({
	id,
	label,
	value,
	onChange,
}: {
	id: string;
	label: string;
	value: string;
	onChange: (value: string) => void;
}) {
	const selected = new Date(value);
	return (
		<div className="space-y-2">
			<Label htmlFor={id}>{label}</Label>
			<div className="flex flex-wrap items-center gap-2">
				<Popover>
					<PopoverTrigger asChild>
						<Button
							id={id}
							variant="outline"
							className="justify-start bg-background font-normal"
						>
							<CalendarDays className="size-4 text-muted-foreground" />
							{selected.toLocaleDateString([], {
								day: 'numeric',
								month: 'short',
								year: 'numeric',
							})}
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-auto p-0" align="start">
						<Calendar
							mode="single"
							selected={selected}
							defaultMonth={selected}
							onSelect={(date) => {
								if (date)
									onChange(
										`${localTime(date.getTime()).slice(0, 10)}T${value.slice(11)}`,
									);
							}}
						/>
					</PopoverContent>
				</Popover>
				<div className="flex items-center gap-1">
					<Clock3
						className="mr-1 size-4 text-muted-foreground"
						aria-hidden="true"
					/>
					<Select
						value={value.slice(11, 13)}
						onValueChange={(hour) =>
							onChange(`${value.slice(0, 11)}${hour}:${value.slice(14, 16)}`)
						}
					>
						<SelectTrigger
							aria-label={`${label} hour (24-hour)`}
							className="w-[68px] bg-background tabular-nums"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent position="popper" className="max-h-60">
							{hours.map((hour) => (
								<SelectItem key={hour} value={hour}>
									{hour}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<span className="text-muted-foreground">:</span>
					<Select
						value={value.slice(14, 16)}
						onValueChange={(minute) =>
							onChange(`${value.slice(0, 14)}${minute}`)
						}
					>
						<SelectTrigger
							aria-label={`${label} minute`}
							className="w-[68px] bg-background tabular-nums"
						>
							<SelectValue />
						</SelectTrigger>
						<SelectContent position="popper" className="max-h-60">
							{minutes.map((minute) => (
								<SelectItem key={minute} value={minute}>
									{minute}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>
		</div>
	);
}

function EventRow({ event }: { event: IncidentEvent }) {
	const Icon = EVENT_ICONS[event.kind];
	return (
		<Collapsible className="group/event">
			<CollapsibleTrigger asChild>
				<Button
					variant="ghost"
					className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal"
				>
					<span
						className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${event.kind === 'gap' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}
					>
						<Icon className="size-4" />
					</span>
					<span className="min-w-0 flex-1">
						<span className="flex items-center gap-2 text-xs text-muted-foreground">
							<time
								dateTime={new Date(event.ts).toISOString()}
								title={dateText(event.ts)}
								className="tabular-nums"
							>
								{clockTime(event.ts)}
							</time>
							<span>{EVENT_LABELS[event.kind]}</span>
						</span>
						<span
							className={`mt-1 block truncate text-sm ${event.kind === 'console' ? 'font-mono' : ''}`}
						>
							{event.summary.replace(/\s+/g, ' ').trim() ||
								'Empty console message'}
						</span>
					</span>
					<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/event:rotate-90" />
				</Button>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<div className="space-y-3 border-t bg-muted/20 px-4 py-4 sm:pl-15">
					<p className="text-xs text-muted-foreground">{dateText(event.ts)}</p>
					<pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed">
						{event.summary}
					</pre>
					{Object.keys(event.data).length > 0 && (
						<Collapsible>
							<CollapsibleTrigger asChild>
								<Button variant="outline" size="sm" className="text-xs">
									Technical details
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<pre className="mt-3 overflow-auto rounded-md bg-muted p-3 text-xs">
									{JSON.stringify(event.data, null, 2)}
								</pre>
							</CollapsibleContent>
						</Collapsible>
					)}
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}

export function EventTimeline({ events }: { events: IncidentEvent[] }) {
	if (!events.length)
		return (
			<Card className="items-center gap-3 border-dashed p-10 text-center">
				<span className="rounded-full bg-muted p-3">
					<Search className="size-5 text-muted-foreground" />
				</span>
				<div>
					<h3 className="font-medium">No events in this view</h3>
					<p className="mt-1 max-w-sm text-sm text-muted-foreground">
						Try a wider time range or another event type. Only events recorded
						since the updated core started are available.
					</p>
				</div>
			</Card>
		);
	const groups: IncidentEvent[][] = [];
	for (const event of events) {
		const previous = groups.at(-1);
		if (
			event.kind === 'console' &&
			previous?.[0]?.kind === 'console' &&
			new Date(previous[0].ts).toDateString() ===
				new Date(event.ts).toDateString()
		)
			previous.push(event);
		else groups.push([event]);
	}
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<ol className="divide-y" aria-label="Event timeline">
				{groups.map((group, index) => {
					const first = group[0];
					if (!first) return null;
					return (
						<li key={first.id}>
							{(!index ||
								new Date(groups[index - 1]?.[0]?.ts ?? 0).toDateString() !==
									new Date(first.ts).toDateString()) && (
								<div className="border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground">
									{new Date(first.ts).toLocaleDateString([], {
										weekday: 'short',
										day: 'numeric',
										month: 'short',
										year: 'numeric',
									})}
								</div>
							)}
							{group.length < 3 ? (
								group.map((event) => <EventRow key={event.id} event={event} />)
							) : (
								<Collapsible className="group/burst">
									<CollapsibleTrigger asChild>
										<Button
											variant="ghost"
											className="h-auto w-full justify-start gap-3 rounded-none px-4 py-3 text-left font-normal"
										>
											<span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
												<Terminal className="size-4 text-muted-foreground" />
											</span>
											<span className="min-w-0 flex-1">
												<span className="block text-xs tabular-nums text-muted-foreground">
													{clockTime(first.ts)} to{' '}
													{clockTime(group[group.length - 1]?.ts ?? first.ts)}
												</span>
												<span className="mt-1 block text-sm">
													{group.length} console messages
												</span>
											</span>
											<Badge
												variant="outline"
												className="hidden sm:inline-flex"
											>
												Expand logs
											</Badge>
											<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/burst:rotate-90" />
										</Button>
									</CollapsibleTrigger>
									<CollapsibleContent className="divide-y border-t bg-muted/10">
										{group.map((event) => (
											<EventRow key={event.id} event={event} />
										))}
									</CollapsibleContent>
								</Collapsible>
							)}
						</li>
					);
				})}
			</ol>
		</Card>
	);
}
