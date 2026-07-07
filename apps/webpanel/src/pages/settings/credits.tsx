import { useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { AlertCircle, ListCheck, Loader2 } from 'lucide-react';
import { formatNumber, initials } from '@/lib/utils';
import type { Contributor } from '@fxmanager/shared/types';
import { useContributorsList } from '@/hooks/use-contributors';

export default function CreditsPage() {
	const { contributors, loading } = useContributorsList();

	if (loading) {
		return (
			<div className="flex flex-col h-full p-6 gap-6">
				<PageHeader
					title="Credits"
					description="A thank you to all the contributors of the fxManager project."
					Icon={ListCheck}
				/>
				<div className="flex-1 flex flex-col items-center justify-center gap-2 text-muted-foreground">
					<Loader2 className="h-6 w-6 animate-spin text-primary" />
					<span className="text-sm font-medium">Fetching contributors...</span>
				</div>
			</div>
		);
	}

	const hasCore = contributors?.core && contributors.core.length > 0;
	const hasExternal =
		contributors?.external && contributors.external.length > 0;

	return (
		<div className="flex flex-col h-full p-6 gap-6">
			<PageHeader
				title="Credits"
				description="A thank you to all the contributors of the fxManager project."
				Icon={ListCheck}
			/>

			<ScrollArea className="flex-1 pr-4">
				<div className="flex flex-col gap-8">
					<div className="flex flex-col gap-4">
						<div className="flex items-center gap-2">
							<h2 className="text-lg font-semibold tracking-tight">
								Core Contributors
							</h2>
							<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
								{contributors?.core?.length || 0}
							</span>
						</div>

						{hasCore ? (
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
								{contributors.core.map((contributor) => (
									<ContributorCard
										key={contributor.username}
										contributor={contributor}
										isCore
									/>
								))}
							</div>
						) : !hasExternal ? (
							<div className="flex flex-col items-center justify-center text-center p-8 rounded-xl border border-dashed bg-muted/30 gap-2">
								<AlertCircle className="h-5 w-5 text-muted-foreground/70" />
								<div className="flex flex-col">
									<p className="text-sm font-medium text-muted-foreground">
										No contributors were loaded
									</p>
									<p className="text-xs text-muted-foreground/60">
										Failed to fetch profile data. Please try reloading the page.
									</p>
								</div>
							</div>
						) : (
							<p className="text-sm text-muted-foreground italic">
								No core contributors listed.
							</p>
						)}
					</div>

					{hasExternal && (
						<div className="flex flex-col gap-4">
							<div className="flex items-center gap-2">
								<h2 className="text-lg font-semibold tracking-tight">
									External Contributors
								</h2>
								<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground">
									{contributors.external.length}
								</span>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
								{contributors.external.map((contributor) => (
									<ContributorCard
										key={contributor.username}
										contributor={contributor}
									/>
								))}
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
}

function ContributorCard({
	contributor,
	isCore = false,
}: {
	contributor: Contributor;
	isCore?: boolean;
}) {
	const [imageError, setImageError] = useState(false);

	return (
		<div
			className="flex items-center justify-between gap-4 p-4 rounded-xl border bg-card text-card-foreground
				shadow-sm transition-all hover:bg-accent/75 hover:text-accent-foreground hover:border-accent-foreground/20"
		>
			<div className="flex flex-row items-center gap-2.5 min-w-0">
				<div
					className={`relative flex items-center justify-center w-14 h-14 rounded-lg border
				text-sm font-medium uppercase overflow-hidden shrink-0 transition-colors group-hover:bg-background
				${isCore ? 'bg-primary/5 border-primary/20 text-primary' : 'bg-muted border-transparent text-muted-foreground'}`}
				>
					{!imageError ? (
						<img
							src={
								contributor.image
									? contributor.image
									: `https://github.com/${contributor.username}.png?size=64`
							}
							alt={`${contributor.username}'s avatar`}
							className="w-full h-full object-cover"
							loading="lazy"
							onError={() => setImageError(true)}
						/>
					) : (
						initials(contributor.username)
					)}
				</div>

				<div className="flex flex-col min-w-0">
					<span className="text-base font-semibold truncate group-hover:underline decoration-1 underline-offset-2">
						{contributor.username}
					</span>
					{contributor.contributions && (
						<span className="text-sm font-light italic truncate group-hover:underline decoration-1 underline-offset-2">
							{formatNumber(contributor.contributions)} contributions
						</span>
					)}
				</div>
			</div>

			<div className="flex items-center gap-1.5 shrink-0 ml-auto self-center">
				<a
					href={`https://github.com/${contributor.username}`}
					target="_blank"
					rel="noopener noreferrer"
					title={`View ${contributor.username}'s GitHub`}
					className="flex items-center justify-center p-2 rounded-lg border bg-fd-background text-fd-muted-foreground
							transition-all duration-200 ease-out
							hover:text-white hover:bg-slate-900 dark:hover:bg-slate-50 dark:hover:text-slate-900
							hover:-translate-y-0.5 hover:scale-105 hover:shadow-md hover:border-transparent"
				>
					<svg
						className="h-4 w-4 fill-current"
						viewBox="0 0 24 24"
						aria-hidden="true"
					>
						<path
							fillRule="evenodd"
							clipRule="evenodd"
							d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
						/>
					</svg>
				</a>

				{contributor.kofi && (
					<a
						href={`https://ko-fi.com/${contributor.kofi}`}
						target="_blank"
						rel="noopener noreferrer"
						title={`Support ${contributor.username} on Ko-fi`}
						className="flex items-center justify-center p-2 rounded-lg bg-red-500/10
							hover:bg-red-500 text-red-500 hover:text-white
							transition-colors duration-200 ease-out
							hover:-translate-y-0.5 hover:scale-105 hover:shadow-md hover:border-transparent"
					>
						<svg
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2.5"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="w-4 h-4"
						>
							<path d="M17 8h1a4 4 0 1 1 0 8h-1" />
							<path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z" />
							<line x1="6" x2="6" y1="2" y2="4" />
							<line x1="10" x2="10" y1="2" y2="4" />
							<line x1="14" x2="14" y1="2" y2="4" />
						</svg>
					</a>
				)}
			</div>
		</div>
	);
}
