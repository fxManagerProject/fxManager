import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	Activity,
	Download,
	RefreshCw,
	ChevronDown,
	Plus,
	History,
	ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { UserPermissions } from '@fxmanager/shared/constants';
import {
	INCIDENT_EVENT_KINDS,
	type IncidentDetail,
	type IncidentEvent,
	type IncidentPage,
	type IncidentStorage,
	type IncidentSummary,
} from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Textarea } from '@fxmanager/ui/components/textarea';
import { Badge } from '@fxmanager/ui/components/badge';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from '@fxmanager/ui/components/dialog';
import { Card } from '@fxmanager/ui/components/card';
import { Label } from '@fxmanager/ui/components/label';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@fxmanager/ui/components/collapsible';
import { Alert, AlertDescription } from '@fxmanager/ui/components/alert';
import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/hooks/use-auth';
import { QueryService } from '@/lib/query';
import { DateTimeField, EventTimeline, EVENT_LABELS } from './components';
import { localTime, dateText } from './time';

const errorText = (error: unknown) =>
	error instanceof Error ? error.message : 'Unable to load incidents.';
const api = <T,>(endpoint: string, body?: unknown) =>
	QueryService<T>({
		endpoint: `/incidents${endpoint}`,
		method: body === undefined ? 'GET' : 'POST',
		body,
	});

export default function IncidentsPage() {
	const { hasPermission } = useAuth();
	const canManage = hasPermission(UserPermissions.INCIDENT_MANAGE);
	const canExport = hasPermission(UserPermissions.INCIDENT_EXPORT);
	const canConfigure = hasPermission(UserPermissions.SETTINGS_ACCESS);
	const [params, setParams] = useSearchParams();
	const selectedId = Number(params.get('id')) || null;
	const selectedRef = useRef(selectedId);
	selectedRef.current = selectedId;
	const [from, setFrom] = useState(() => localTime(Date.now() - 60 * 60_000));
	const [to, setTo] = useState(() => localTime(Date.now()));
	const [kind, setKind] = useState('');
	const [timeline, setTimeline] = useState<IncidentPage<IncidentEvent>>({
		items: [],
		nextCursor: null,
	});
	const [list, setList] = useState<IncidentPage<IncidentSummary>>({
		items: [],
		nextCursor: null,
	});
	const [detail, setDetail] = useState<IncidentDetail | null>(null);
	const applyDetail = (next: IncidentDetail) => {
		if (selectedRef.current === next.id) setDetail(next);
	};
	const [storage, setStorage] = useState<IncidentStorage | null>(null);
	const [days, setDays] = useState('30');
	const [budget, setBudget] = useState('128');
	const [createOpen, setCreateOpen] = useState(false);
	const [title, setTitle] = useState('');
	const [description, setDescription] = useState('');
	const [note, setNote] = useState('');
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);
	const [loading, setLoading] = useState(true);
	const [evidencePage, setEvidencePage] = useState(0);
	const timelineRequest = useRef(0);

	const loadList = useCallback(async (cursor?: number) => {
		const result = await api<IncidentPage<IncidentSummary>>(
			`/${cursor ? `?cursor=${cursor}` : ''}`,
		);
		setList((previous) =>
			cursor
				? { ...result, items: [...previous.items, ...result.items] }
				: result,
		);
	}, []);

	const loadTimeline = useCallback(
		async (cursor?: number) => {
			const request = ++timelineRequest.current;
			setLoading(true);
			try {
				const start = new Date(from).getTime();
				const end = new Date(to).getTime() + 59_999;
				if (!Number.isFinite(start) || !Number.isFinite(end))
					throw new Error('Select a valid start and end time.');
				const query = new URLSearchParams({
					from: String(start),
					to: String(Math.min(end, Date.now())),
				});
				if (cursor) query.set('cursor', String(cursor));
				if (kind) query.set('kind', kind);
				const result = await api<IncidentPage<IncidentEvent>>(
					`/timeline?${query}`,
				);
				if (request !== timelineRequest.current) return;
				setTimeline((previous) =>
					cursor
						? { ...result, items: [...previous.items, ...result.items] }
						: result,
				);
				setError('');
			} catch (err) {
				if (request === timelineRequest.current) {
					setError(errorText(err));
					setTimeline({ items: [], nextCursor: null });
				}
			} finally {
				if (request === timelineRequest.current) setLoading(false);
			}
		},
		[from, to, kind],
	);

	useEffect(() => {
		let cancelled = false;
		void Promise.all([loadList(), api<IncidentStorage>('/storage')])
			.then(([, result]) => {
				if (cancelled) return;
				setStorage(result);
				setDays(String(result.retentionDays));
				setBudget(String(result.maxStorageMB));
			})
			.catch((err) => {
				if (!cancelled) setError(errorText(err));
			});
		return () => {
			cancelled = true;
		};
	}, [loadList]);

	useEffect(() => {
		void loadTimeline();
		return () => {
			timelineRequest.current++;
		};
	}, [loadTimeline]);

	useEffect(() => {
		let cancelled = false;
		setDetail(null);
		setNote('');
		setEvidencePage(0);
		if (selectedId)
			void api<IncidentDetail>(`/${selectedId}`)
				.then((result) => {
					if (!cancelled) {
						setDetail(result);
						setError('');
					}
				})
				.catch((err) => {
					if (!cancelled) setError(errorText(err));
				});
		return () => {
			cancelled = true;
		};
	}, [selectedId]);

	async function mutate(action: () => Promise<void>) {
		setBusy(true);
		setError('');
		try {
			await action();
		} catch (err) {
			setError(errorText(err));
		} finally {
			setBusy(false);
		}
	}

	async function createIncident() {
		const created = await api<IncidentDetail>('/', {
			title,
			description,
			from: new Date(from).getTime(),
			to: Math.min(new Date(to).getTime() + 59_999, Date.now()),
		});
		setCreateOpen(false);
		setTitle('');
		setDescription('');
		await loadList();
		setParams({ id: String(created.id) });
		toast.success('Incident created with preserved evidence.');
	}

	async function exportIncident() {
		if (!detail) return;
		const bundle = await api<unknown>(`/${detail.id}/export`);
		const url = URL.createObjectURL(
			new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }),
		);
		const anchor = document.createElement('a');
		anchor.href = url;
		anchor.download = `incident-${detail.id}.json`;
		anchor.click();
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}

	return (
		<ScrollArea className="h-full">
			<div className="flex min-h-0 flex-1 flex-col gap-6 p-4">
				<PageHeader
					Icon={Activity}
					title="Incident Center"
					description="Investigate server events and preserve evidence for your team."
				/>
				{error && (
					<Alert variant="destructive">
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				<div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
					<aside className="space-y-3 rounded-xl border bg-card/50 p-3 lg:sticky lg:top-0">
						<Button
							variant={selectedId ? 'outline' : 'default'}
							className="w-full"
							onClick={() => setParams({})}
						>
							<History className="size-4" /> Server history
						</Button>
						<div className="flex items-center justify-between">
							<h2 className="text-sm font-semibold">Saved incidents</h2>
							<Button
								variant="ghost"
								size="icon"
								aria-label="Refresh incidents"
								disabled={busy}
								onClick={() => void mutate(() => loadList())}
							>
								<RefreshCw className="size-4" />
							</Button>
						</div>
						{!list.items.length && (
							<p className="text-sm text-muted-foreground">
								No incidents yet. Select a time range from history to create
								one.
							</p>
						)}
						{list.items.map((incident) => (
							<Button
								variant="ghost"
								key={incident.id}
								type="button"
								disabled={busy}
								onClick={() => setParams({ id: String(incident.id) })}
								className={`block h-auto w-full whitespace-normal rounded-lg border border-transparent bg-background/50 p-3 text-left hover:bg-accent ${selectedId === incident.id ? 'border-primary/40 bg-primary/5' : ''}`}
							>
								<div className="mb-2 flex justify-between text-xs text-muted-foreground">
									<span>#{incident.id}</span>
									<Badge
										variant={
											incident.status === 'open' ? 'secondary' : 'outline'
										}
									>
										{incident.status}
									</Badge>
								</div>
								<p className="break-words text-sm font-medium">
									{incident.title}
								</p>
								<p className="mt-2 text-xs text-muted-foreground">
									{dateText(incident.createdAt)} · {incident.eventCount} events
								</p>
							</Button>
						))}
						{list.nextCursor !== null && (
							<Button
								variant="outline"
								disabled={busy}
								onClick={() =>
									void mutate(() => loadList(list.nextCursor ?? undefined))
								}
							>
								More incidents
							</Button>
						)}
					</aside>
					<div className="min-w-0 space-y-6">
						{selectedId ? (
							detail ? (
								<>
									<Card className="gap-4 p-5">
										<div className="flex flex-wrap items-start justify-between gap-3">
											<div>
												<Badge variant="outline">{detail.status}</Badge>
												<h2 className="mt-2 break-words text-xl font-semibold">
													{detail.title}
												</h2>
											</div>
											<div className="flex gap-2">
												{canManage && (
													<Button
														disabled={busy}
														variant="outline"
														onClick={() =>
															void mutate(async () => {
																applyDetail(
																	await api<IncidentDetail>(
																		`/${detail.id}/status`,
																		{
																			status:
																				detail.status === 'open'
																					? 'resolved'
																					: 'open',
																		},
																	),
																);
																await loadList();
															})
														}
													>
														{detail.status === 'open' ? 'Resolve' : 'Reopen'}
													</Button>
												)}
												{canExport && (
													<Button
														disabled={busy}
														variant="outline"
														onClick={() => void mutate(exportIncident)}
													>
														<Download className="mr-2 size-4" />
														Export
													</Button>
												)}
											</div>
										</div>
										<p className="text-sm text-muted-foreground">
											{dateText(detail.from)} — {dateText(detail.to)} ·{' '}
											{detail.eventCount} preserved events
										</p>
										<p className="whitespace-pre-wrap break-words text-sm">
											{detail.description || 'No description provided.'}
										</p>
										<p className="text-xs text-muted-foreground">
											Evidence is a snapshot of the available history when this
											incident was created. Gaps or previously expired events
											cannot be recovered. Exports omit console and staff free
											text, paths, and player identifiers.
										</p>
									</Card>
									<section className="space-y-3">
										<h3 className="font-semibold">Investigation notes</h3>
										{detail.notes.map((entry) => (
											<div key={entry.id} className="rounded-lg border p-3">
												<time className="text-xs text-muted-foreground">
													{dateText(entry.createdAt)}
												</time>
												<p className="mt-1 whitespace-pre-wrap break-words text-sm">
													{entry.content}
												</p>
											</div>
										))}
										{!detail.notes.length && (
											<p className="text-sm text-muted-foreground">
												No investigation notes yet.
											</p>
										)}
										{canManage && (
											<form
												className="space-y-2"
												onSubmit={(event) => {
													event.preventDefault();
													void mutate(async () => {
														applyDetail(
															await api<IncidentDetail>(`/${detail.id}/notes`, {
																content: note,
															}),
														);
														setNote('');
													});
												}}
											>
												<Label htmlFor="incident-note" className="text-sm">
													Add an investigation note
												</Label>
												<Textarea
													id="incident-note"
													value={note}
													onChange={(event) => setNote(event.target.value)}
													maxLength={4000}
													required
												/>
												<Button disabled={busy || !note.trim()} type="submit">
													Add note
												</Button>
											</form>
										)}
									</section>
									<section className="space-y-3">
										<h3 className="font-semibold">Preserved evidence</h3>
										<EventTimeline
											events={detail.evidence.slice(
												evidencePage * 100,
												(evidencePage + 1) * 100,
											)}
										/>
										<div className="flex items-center gap-3">
											<Button
												variant="outline"
												disabled={evidencePage === 0}
												onClick={() => setEvidencePage((page) => page - 1)}
											>
												Previous
											</Button>
											<span className="text-sm">
												Page {evidencePage + 1} of{' '}
												{Math.max(1, Math.ceil(detail.evidence.length / 100))}
											</span>
											<Button
												variant="outline"
												disabled={
													(evidencePage + 1) * 100 >= detail.evidence.length
												}
												onClick={() => setEvidencePage((page) => page + 1)}
											>
												Next
											</Button>
										</div>
									</section>
								</>
							) : (
								<p className="text-muted-foreground">
									{error
										? 'Select another incident or return to recorded history.'
										: 'Loading incident…'}
								</p>
							)
						) : (
							<>
								<Card className="gap-4 p-5">
									<div>
										<h2 className="font-semibold">Explore server activity</h2>
										<p className="text-sm text-muted-foreground">
											Choose when the problem happened, review the events, then
											save an incident for your team.
										</p>
									</div>
									<div className="flex flex-wrap items-center gap-2">
										<span className="mr-1 text-xs font-medium text-muted-foreground">
											Quick range
										</span>
										{[
											{ label: '15 minutes', minutes: 15 },
											{ label: '1 hour', minutes: 60 },
											{ label: '6 hours', minutes: 360 },
										].map((preset) => (
											<Button
												key={preset.minutes}
												variant="outline"
												size="sm"
												disabled={busy}
												onClick={() => {
													const now = Date.now();
													setFrom(localTime(now - preset.minutes * 60_000));
													setTo(localTime(now));
												}}
											>
												{preset.label}
											</Button>
										))}
									</div>
									<div className="flex flex-wrap items-end gap-3">
										<DateTimeField
											id="incident-from"
											label="From"
											value={from}
											onChange={setFrom}
										/>
										<DateTimeField
											id="incident-to"
											label="To"
											value={to}
											onChange={setTo}
										/>
										<div className="space-y-2">
											<Label htmlFor="incident-kind">Event type</Label>
											<Select
												value={kind || 'all'}
												onValueChange={(value) =>
													setKind(value === 'all' ? '' : value)
												}
											>
												<SelectTrigger
													id="incident-kind"
													className="w-full sm:w-[160px] bg-white dark:bg-zinc-950"
												>
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectItem value="all">All events</SelectItem>
													{INCIDENT_EVENT_KINDS.map((entry) => (
														<SelectItem key={entry} value={entry}>
															{EVENT_LABELS[entry]}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<Button
											variant="outline"
											disabled={loading}
											onClick={() => {
												const next = localTime(Date.now());
												if (next === to) void loadTimeline();
												else setTo(next);
											}}
										>
											<RefreshCw className="mr-2 size-4" />
											Refresh
										</Button>
									</div>
									<div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
										<p className="text-xs text-muted-foreground">
											Local time / 24-hour clock / Maximum range: 24 hours
										</p>
										{canManage && (
											<Button
												disabled={busy || loading || !timeline.items.length}
												onClick={() => {
													setError('');
													setCreateOpen(true);
												}}
											>
												<Plus className="size-4" />
												Create incident
												<ArrowRight className="size-4" />
											</Button>
										)}
									</div>
								</Card>
								{loading && (
									<p role="status" className="text-sm text-muted-foreground">
										Loading events…
									</p>
								)}
								<section className="space-y-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<h2 className="font-semibold">Event timeline</h2>
											<p className="text-xs text-muted-foreground">
												Select an event to inspect it. Consecutive console
												messages are grouped.
											</p>
										</div>
										<Badge variant="outline">
											{timeline.items.length}
											{timeline.nextCursor !== null ? '+' : ''} events loaded
										</Badge>
									</div>
									<EventTimeline events={timeline.items} />
								</section>
								{timeline.nextCursor !== null && (
									<Button
										variant="outline"
										disabled={loading}
										onClick={() =>
											void loadTimeline(timeline.nextCursor ?? undefined)
										}
									>
										Load more events
									</Button>
								)}
							</>
						)}
					</div>
				</div>
				{storage && (
					<Card className="p-4">
						<Collapsible>
							<CollapsibleTrigger asChild>
								<Button
									variant="ghost"
									className="h-auto w-full justify-between whitespace-normal text-left"
								>
									Retention and storage ·{' '}
									{(storage.usedBytes / 1024 / 1024).toFixed(1)} /{' '}
									{storage.maxStorageMB} MiB · {storage.retentionDays} days
									<ChevronDown className="ml-2 size-4 shrink-0" />
								</Button>
							</CollapsibleTrigger>
							<CollapsibleContent>
								<div className="mt-4 space-y-3 text-sm">
									<p className="text-muted-foreground">
										Limits cover stored event and evidence payloads; SQLite
										files and indexes add overhead. Oldest history is removed
										first, then oldest incidents if necessary. Incident expiry
										starts at creation, including unresolved incidents. Lowering
										limits removes older data immediately.
									</p>
									<p>
										Oldest available event:{' '}
										{storage.oldestEventAt
											? dateText(storage.oldestEventAt)
											: 'None yet'}
									</p>
									{canConfigure && (
										<form
											className="flex flex-wrap items-end gap-3"
											onSubmit={(event) => {
												event.preventDefault();
												void mutate(async () => {
													setStorage(
														await api<IncidentStorage>('/storage', {
															retentionDays: Number(days),
															maxStorageMB: Number(budget),
														}),
													);
													await loadList();
													await loadTimeline();
													if (selectedId) {
														setDetail(null);
														setParams({});
													}
													toast.success('Retention limits saved.');
												});
											}}
										>
											<Label className="flex-col items-start gap-2">
												Retention days
												<Input
													type="number"
													min={1}
													max={365}
													required
													value={days}
													onChange={(event) => setDays(event.target.value)}
												/>
											</Label>
											<Label className="flex-col items-start gap-2">
												Payload budget (MiB)
												<Input
													type="number"
													min={16}
													max={2048}
													required
													value={budget}
													onChange={(event) => setBudget(event.target.value)}
												/>
											</Label>
											<Button type="submit" disabled={busy}>
												Apply limits and prune
											</Button>
										</form>
									)}
								</div>
							</CollapsibleContent>
						</Collapsible>
					</Card>
				)}
			</div>
			{canManage && (
				<Dialog
					open={createOpen}
					onOpenChange={(open) => {
						if (!busy) setCreateOpen(open);
					}}
				>
					<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
						<DialogHeader>
							<DialogTitle>Create incident</DialogTitle>
							<DialogDescription>
								Give your team a clear description. Events from the selected
								time range will be saved with this incident.
							</DialogDescription>
						</DialogHeader>
						<div className="rounded-lg border bg-muted/40 p-3 text-sm">
							<p className="mb-1 font-medium">Selected time range</p>
							<p className="text-muted-foreground">
								{dateText(new Date(from).getTime())} to{' '}
								{dateText(new Date(to).getTime())}
							</p>
						</div>
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}
						<form
							className="space-y-4"
							onSubmit={(event) => {
								event.preventDefault();
								void mutate(createIncident);
							}}
						>
							<Label htmlFor="incident-title" className="text-sm">
								Incident title
							</Label>
							<Input
								id="incident-title"
								value={title}
								onChange={(event) => setTitle(event.target.value)}
								required
								maxLength={160}
								placeholder="e.g. Players disconnected after a resource restart"
							/>
							<Label htmlFor="incident-description" className="block text-sm">
								Description
							</Label>
							<Textarea
								id="incident-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								maxLength={4000}
								placeholder="What happened, and what needs investigating?"
							/>
							<div className="flex justify-end gap-2">
								<Button
									type="button"
									variant="outline"
									disabled={busy}
									onClick={() => setCreateOpen(false)}
								>
									Cancel
								</Button>
								<Button
									disabled={busy || loading || !title.trim() || !from || !to}
									type="submit"
								>
									{busy ? 'Saving...' : 'Save incident'}
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">
								All event types in this range are saved, including console
								messages. Choose a smaller range if it contains more than 5,000
								events.
							</p>
						</form>
					</DialogContent>
				</Dialog>
			)}
			<ScrollBar orientation="vertical" />
		</ScrollArea>
	);
}
