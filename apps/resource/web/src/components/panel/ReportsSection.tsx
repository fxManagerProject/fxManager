import { useState } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { UserPermissions } from '@fxmanager/shared/constants';
import { PermissionManager } from '@fxmanager/shared/utils';
import type { ReportDetail } from '@fxmanager/shared/types';
import { Flag, Plus, Search, Send } from 'lucide-react';

const STATUS = {
	open: 'Open',
	inprogress: 'In progress',
	resolved: 'Resolved',
};

// Backend integration is deliberately deferred; supplied data is presentation-only.
export function ReportsSection({
	permissions,
	reports = [],
}: {
	permissions: number;
	reports?: ReportDetail[];
}) {
	const staff = PermissionManager.has(permissions, UserPermissions.VIEW_REPORT);
	const [selected, setSelected] = useState<number | null>(null);
	const [creating, setCreating] = useState(false);
	const [search, setSearch] = useState('');
	const [subject, setSubject] = useState('');
	const [message, setMessage] = useState('');
	const detail =
		reports.find((report) => report.id === selected) ??
		(!staff ? reports[0] : undefined);
	const filtered = reports.filter((report) =>
		`${report.subject} ${report.reporterName} ${report.id}`
			.toLocaleLowerCase()
			.includes(search.toLocaleLowerCase()),
	);
	return (
		<section
			className="flex h-full min-h-0 flex-col gap-4"
			aria-label="Reports"
		>
			<header className="flex items-start justify-between gap-3">
				<div>
					<h2 className="text-xl font-semibold">
						{staff ? 'Report desk' : 'Your report'}
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						{staff
							? 'Review player requests and conversations.'
							: 'Ask staff for help and follow your conversation here.'}
					</p>
				</div>
				<Button size="sm" onClick={() => setCreating(true)}>
					<Plus className="mr-2 size-4" />
					New report
				</Button>
			</header>
			<p
				role="status"
				className="rounded-md border p-3 text-sm text-muted-foreground"
			>
				Reports are not connected yet. Submitting reports, replies and status
				changes will be available after backend integration.
			</p>
			{staff && (
				<div className="flex flex-wrap gap-6 border-y py-3 text-sm">
					<span>
						{reports.filter((r) => r.status !== 'resolved').length} awaiting
						resolution
					</span>
					<span>
						{reports.filter((r) => r.status === 'inprogress').length} in
						progress
					</span>
					<span>
						{reports.filter((r) => r.status === 'resolved').length} resolved
					</span>
				</div>
			)}
			<div
				className={`grid min-h-0 flex-1 gap-4 ${staff ? 'lg:grid-cols-[340px_minmax(0,1fr)]' : ''}`}
			>
				{staff && (
					<aside className="flex min-h-0 flex-col rounded-md border">
						<div className="relative border-b p-3">
							<Search className="absolute left-6 top-6 size-4 text-muted-foreground" />
							<Input
								className="pl-9"
								aria-label="Search reports"
								placeholder="Search subject, player or report #"
								value={search}
								onChange={(e) => setSearch(e.target.value)}
							/>
						</div>
						<div className="overflow-y-auto">
							{filtered.map((report) => (
								<button
									type="button"
									key={report.id}
									aria-pressed={selected === report.id}
									className={`flex w-full flex-col gap-2 border-b p-4 text-left ${selected === report.id ? 'bg-secondary' : 'hover:bg-muted/40'}`}
									onClick={() => {
										setSelected(report.id);
										setCreating(false);
									}}
								>
									<span className="text-xs text-muted-foreground">
										#{report.id} · {report.reporterName} ·{' '}
										{STATUS[report.status]}
									</span>
									<span className="break-words text-sm font-medium">
										{report.subject}
									</span>
								</button>
							))}
							{!filtered.length && (
								<p className="p-5 text-sm text-muted-foreground">
									{search ? 'No matching reports.' : 'No reports to display.'}
								</p>
							)}
						</div>
					</aside>
				)}
				<div className="flex min-h-0 min-w-0 flex-col overflow-y-auto rounded-md border">
					{creating ? (
						<form
							className="flex w-full max-w-2xl flex-col gap-4 p-5"
							onSubmit={(event) => event.preventDefault()}
						>
							<h3 className="text-lg font-semibold">New report</h3>
							<label className="flex flex-col gap-2 text-sm font-medium">
								Subject
								<Input
									maxLength={120}
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									placeholder="Briefly describe the issue"
								/>
							</label>
							<label className="flex flex-col gap-2 text-sm font-medium">
								Description
								<textarea
									rows={7}
									maxLength={2000}
									className="rounded-md border bg-background p-3 font-normal"
									value={message}
									onChange={(e) => setMessage(e.target.value)}
									placeholder="Describe what happened and where."
								/>
							</label>
							<div className="flex gap-2">
								<Button type="submit" disabled>
									Submit report
								</Button>
								<Button
									type="button"
									variant="ghost"
									onClick={() => setCreating(false)}
								>
									Cancel
								</Button>
							</div>
						</form>
					) : detail ? (
						<>
							<header className="border-b p-4">
								<p className="text-xs text-muted-foreground">
									Report #{detail.id} · {STATUS[detail.status]}
								</p>
								<h3 className="mt-1 break-words text-lg font-semibold">
									{detail.subject}
								</h3>
							</header>
							<div
								className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
								aria-label="Report conversation"
							>
								{detail.messages.map((item) => (
									<article
										key={item.id}
										className="border-b pb-4 last:border-0"
									>
										<div className="mb-2 flex gap-2 text-xs">
											<strong>{item.author}</strong>
											{item.staff && <span>Staff</span>}
											<time className="ml-auto text-muted-foreground">
												{new Date(item.timestamp).toLocaleString()}
											</time>
										</div>
										<p className="whitespace-pre-wrap break-words text-sm">
											{item.message}
										</p>
									</article>
								))}
							</div>
							<div className="flex flex-col gap-2 border-t p-4">
								<label htmlFor="report-reply" className="text-sm font-medium">
									Reply
								</label>
								<textarea
									id="report-reply"
									rows={3}
									disabled
									className="rounded-md border bg-background p-3 text-sm"
									placeholder="Replies are not available yet."
								/>
								<Button disabled className="self-end">
									<Send className="mr-2 size-4" />
									Send reply
								</Button>
							</div>
						</>
					) : (
						<div className="flex flex-1 flex-col justify-center gap-4 p-8">
							<Flag className="size-7 text-primary" />
							<h3 className="text-lg font-semibold">
								{staff ? 'Select a report' : 'Need a hand?'}
							</h3>
							<p className="max-w-lg text-sm text-muted-foreground">
								{staff
									? 'Player conversations will appear here once Reports is connected.'
									: 'Use New report to prepare a description. Sending will be enabled when Reports is connected.'}
							</p>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
