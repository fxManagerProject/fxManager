import { useEffect, useState } from 'react';
import { Users, Search, ArrowUpDown, ShieldAlert } from 'lucide-react';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@fxmanager/ui/components/table';
import { Card } from '@fxmanager/ui/components/card';
import { Badge } from '@fxmanager/ui/components/badge';
import { Input } from '@fxmanager/ui/components/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import { QueryService } from '@/lib/query';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDuration } from '@/lib/utils';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import { usePlayerAction } from '@/hooks/use-player-actions';
import { PlayerActionDialog } from '@/components/player-actions-dialog';
import { PageHeader } from '@/components/page-header';
import { Button } from '@fxmanager/ui/components/button';
import PageSizeSelector from '@/components/page-size-selector';
import PageSelector from '@/components/page-selector';
import type { PaginatedResponse, Player } from '@fxmanager/shared/types';

type SortBy = 'lastSeen' | 'firstSeen' | 'playtime';
type SortOrder = 'asc' | 'desc';

export default function Players() {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();

	const { dialogOpen, dialogPlayer, dialogTab, openAction, closeAction } =
		usePlayerAction();
	const [players, setPlayers] = useState<Omit<Player, 'identifiers'>[]>([]);
	const [total, setTotal] = useState(0);

	const search = searchParams.get('search') ?? '';
	const sortBy = (searchParams.get('sortBy') as SortBy) ?? 'lastSeen';
	const sortOrder = (searchParams.get('sortOrder') as SortOrder) ?? 'desc';
	const page = Number(searchParams.get('page') ?? 1);
	const pageSize = Number(searchParams.get('pageSize') ?? 20);

	const debouncedSearch = useDebounce(search, 300);
	const loading = players === null;

	// helpers functions to update individual params
	const setSearch = (v: string) =>
		setSearchParams(
			(p) => {
				if (v) {
					p.set('search', v);
				} else {
					p.delete('search');
				}
				p.set('page', '1');
				return p;
			},
			{ replace: true },
		);
	const setSortBy = (v: SortBy) =>
		setSearchParams(
			(p) => {
				p.set('sortBy', v);
				p.set('page', '1');
				return p;
			},
			{ replace: true },
		);
	const setSortOrder = (v: SortOrder) =>
		setSearchParams(
			(p) => {
				p.set('sortOrder', v);
				return p;
			},
			{ replace: true },
		);
	const setPage = (v: number) =>
		setSearchParams(
			(p) => {
				p.set('page', v.toString());
				return p;
			},
			{ replace: true },
		);
	const setPageSize = (v: number) =>
		setSearchParams(
			(p) => {
				p.set('pageSize', v.toString());
				p.set('page', '1');
				return p;
			},
			{ replace: true },
		);
	const toggleSortOrder = () =>
		setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');

	useEffect(() => {
		let cancelled = false;

		const params = new URLSearchParams({
			sortBy,
			sortOrder,
			page: page.toString(),
			pageSize: pageSize.toString(),
		});

		if (debouncedSearch) params.set('search', debouncedSearch);

		QueryService<PaginatedResponse<Omit<Player, 'identifiers'>>>({
			endpoint: `/players?${params.toString()}`,
			method: 'GET',
		}).then((response) => {
			if (cancelled) return;

			const { items, total: newTotal } = response;

			setPlayers(items);
			setTotal(newTotal);
		});

		return () => {
			cancelled = true;
		};
	}, [debouncedSearch, sortBy, sortOrder, page, pageSize]);

	return (
		<div className="flex flex-col gap-6 h-full p-4">
			<PageHeader Icon={Users} title="Players" />

			<div className="flex flex-wrap items-center gap-3 shrink-0">
				<div className="relative flex-1 min-w-[200px] max-w-sm">
					<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search by name or identifier..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="pl-8"
					/>
				</div>

				<Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
					<SelectTrigger className="w-40">
						<SelectValue placeholder="Sort by" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="lastSeen">Last seen</SelectItem>
						<SelectItem value="firstSeen">First seen</SelectItem>
						<SelectItem value="playtime">Playtime</SelectItem>
					</SelectContent>
				</Select>

				<Button
					variant="outline"
					onClick={toggleSortOrder}
					className="w-40 justify-between"
				>
					<span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
					<ArrowUpDown className="h-4 w-4" />
				</Button>
			</div>

			<Card className="bg-card/50 py-0 flex-1 flex flex-col min-h-0">
				<ScrollArea className="rounded-t-lg flex-1 w-full max-w-full">
					<Table className="table-fixed w-full min-w-[800px]">
						<TableHeader className="bg-card sticky top-0 z-10 block w-full shadow-sm">
							<TableRow className="flex w-full">
								<TableHead className="pl-4 flex-1 flex items-center">
									Name
								</TableHead>
								<TableHead className="flex-1 flex items-center">
									First seen
								</TableHead>
								<TableHead className="flex-1 flex items-center">
									Last seen
								</TableHead>
								<TableHead className="flex-1 flex items-center">
									Playtime
								</TableHead>
								<TableHead className="w-70 flex items-center" />
							</TableRow>
						</TableHeader>

						<TableBody className="block w-full">
							{loading ? (
								<TableRow className="flex w-full">
									<TableCell
										colSpan={5}
										className="flex-1 text-center text-muted-foreground"
									>
										Loading...
									</TableCell>
								</TableRow>
							) : players.length === 0 ? (
								<TableRow className="flex w-full">
									<TableCell
										colSpan={5}
										className="flex-1 text-center text-muted-foreground"
									>
										{search
											? `No players matching "${search}"`
											: 'No players found'}
									</TableCell>
								</TableRow>
							) : (
								players.map((p) => (
									<TableRow
										key={p.id}
										className="flex w-full items-center"
										onClick={() => navigate(`/players/${p.id}`)}
									>
										<TableCell className="font-medium pl-4 flex-1 truncate">
											{p.name}
											{p.isStaff && (
												<Badge variant="link" className="ml-2 text-xs">
													Staff
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground flex-1">
											{new Date(p.firstSeen).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground flex-1">
											{new Date(p.lastSeen).toLocaleString()}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground flex-1">
											{formatDuration(p.playtime)}
										</TableCell>
										<TableCell className="w-70 flex justify-around">
											<Button
												size="sm"
												variant="outline"
												className="h-7 w-30"
												onClick={(e) => {
													e.stopPropagation();
													openAction(p);
												}}
											>
												<ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Actions
											</Button>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>

					<ScrollBar orientation="horizontal" className="hidden" />
				</ScrollArea>

				<div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 border-t border-border bg-card shrink-0">
					<PageSizeSelector
						pageSize={pageSize}
						setPageSize={setPageSize}
						label="Players per page"
					/>
					<PageSelector
						page={page}
						pageSize={pageSize}
						setPage={setPage}
						loading={loading}
						total={total}
					/>
				</div>
			</Card>

			<PlayerActionDialog
				player={dialogPlayer}
				open={dialogOpen}
				defaultTab={dialogTab}
				onClose={closeAction}
			/>
		</div>
	);
}
