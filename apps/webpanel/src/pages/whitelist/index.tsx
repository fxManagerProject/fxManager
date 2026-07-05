import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
	ScanEye,
	Search,
	Plus,
	ArrowUpDown,
	ShieldCheck,
	Trash2,
	Loader2,
	Server,
	UserX2,
} from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { Button } from '@fxmanager/ui/components/button';
import { Input } from '@fxmanager/ui/components/input';
import { Badge } from '@fxmanager/ui/components/badge';
import { Card } from '@fxmanager/ui/components/card';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import {
	Table,
	TableHeader,
	TableRow,
	TableHead,
	TableBody,
	TableCell,
} from '@fxmanager/ui/components/table';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import PageSizeSelector from '@/components/page-size-selector';
import PageSelector from '@/components/page-selector';
import type {
	ApiResponse,
	PaginatedResponse,
	WhitelistEntry,
} from '@fxmanager/shared/types';
import { QueryService } from '@/lib/query';
import { useDebounce } from '@/hooks/use-debounce';
import { toast } from 'sonner';
import { Label } from '@fxmanager/ui/components/label';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@fxmanager/ui/components/dialog';
import { copyToClipboard } from '@/lib/utils';

type SortBy = 'addedAt' | 'identifier';
type SortOrder = 'asc' | 'desc';

// Add this helper outside your component
const formatIdentifier = (val: string) => {
	const str = val.includes(':') ? val.split(':')[1] : val;
	return str;
};

export default function WhitelistIndex() {
	const [searchParams, setSearchParams] = useSearchParams();

	const [isDeleting, setIsDeleting] = useState<number | null>(null);
	const [addForm, setAddForm] = useState<{ type: string; value: string }>({
		type: 'discord',
		value: '',
	});
	const [entries, setEntries] = useState<WhitelistEntry[] | null>(null);
	const [total, setTotal] = useState(0);

	const search = searchParams.get('search') ?? '';
	const sortBy = (searchParams.get('sortBy') as SortBy) ?? 'addedAt';
	const sortOrder = (searchParams.get('sortOrder') as SortOrder) ?? 'desc';
	const page = Number(searchParams.get('page') ?? 1);
	const pageSize = Number(searchParams.get('pageSize') ?? 20);

	const debouncedSearch = useDebounce(search, 300);
	const loading = entries === null;

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

	const fetchFromServer = useCallback(
		async (cancelled = { current: false }) => {
			try {
				const params = new URLSearchParams({
					sortBy,
					sortOrder,
					page: page.toString(),
					pageSize: pageSize.toString(),
				});

				if (debouncedSearch) params.set('search', debouncedSearch);

				const response = await QueryService<PaginatedResponse<WhitelistEntry>>({
					endpoint: `/whitelist?${params.toString()}`,
					method: 'GET',
				});

				if (cancelled.current) return;

				const { items, total: newTotal } = response;
				setEntries(items);
				setTotal(newTotal);
			} catch (err) {
				toast.error((err as Error).message);
			}
		},
		[debouncedSearch, sortBy, sortOrder, page, pageSize],
	);

	const handleDelete = async (id: number) => {
		setIsDeleting(id);
		try {
			const response = await QueryService<ApiResponse>({
				endpoint: `/whitelist/revoke`,
				method: 'POST',
				body: { id },
			});

			if (!response.success) {
				toast.error(response.error);
			} else {
				toast.success('Entry removed from whitelist');
				fetchFromServer();
			}
		} catch (err) {
			toast.error((err as Error).message);
		} finally {
			setIsDeleting(null);
		}
	};

	const handleAdd = async () => {
		if (addForm.value.length < 5) {
			toast.error('Value is too short');
			return;
		}

		try {
			const response = await QueryService<ApiResponse>({
				endpoint: `/whitelist/add`,
				method: 'POST',
				body: addForm,
			});

			if (!response.success) {
				toast.error(response.error);
			} else {
				toast.success('Entry added to whitelist');
				setAddForm((prev) => ({ ...prev, value: '' }));

				fetchFromServer();
			}
		} catch (err) {
			toast.error((err as Error).message);
		}
	};

	useEffect(() => {
		const cancelled = { current: false };

		fetchFromServer(cancelled);

		return () => {
			cancelled.current = true;
		};
	}, [fetchFromServer]);

	return (
		<div className="flex h-full flex-col gap-4 p-4">
			<PageHeader
				Icon={ScanEye}
				title="Whitelist Management"
				description="Handle whitelist management."
			/>

			<div className="flex flex-wrap items-center justify-between gap-4 shrink-0">
				<div className="flex flex-wrap items-center gap-3">
					<div className="relative flex-1 min-w-[200px] max-w-sm">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name, identifier..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-8"
						/>
					</div>

					<Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
						<SelectTrigger className="w-32 lg:w-40">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="addedAt">Added at</SelectItem>
							<SelectItem value="value">Identifier</SelectItem>
						</SelectContent>
					</Select>

					<Button
						variant="outline"
						onClick={toggleSortOrder}
						className="w-12 lg:w-40 justify-center lg:justify-between px-0 lg:px-4"
					>
						<span className="hidden lg:block">
							{sortOrder === 'asc' ? 'Ascending' : 'Descending'}
						</span>
						<ArrowUpDown className="h-4 w-4" />
					</Button>
				</div>

				<Dialog>
					<DialogTrigger asChild>
						<Button>
							<Plus className="mr-2 h-4 w-4" /> Add Whitelist
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-[425px] bg-zinc-950 border-zinc-800">
						<DialogHeader>
							<DialogTitle>Add Whitelist Entry</DialogTitle>
							<DialogDescription>
								Enter the player identifier below.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-4 py-4">
							<div className="space-y-2 w-full">
								<Label className="text-sm font-medium">Identifier Type</Label>
								<Select
									defaultValue="license"
									value={addForm.type}
									onValueChange={(type) =>
										setAddForm((prev) => ({ ...prev, type }))
									}
								>
									<SelectTrigger className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="license">License</SelectItem>
										<SelectItem value="discord">Discord</SelectItem>
										<SelectItem value="steam">Steam</SelectItem>
									</SelectContent>
								</Select>
							</div>
							<div className="space-y-2">
								<Label className="text-sm font-medium">Value</Label>
								<Input
									placeholder="e.g. license:abc123..."
									value={addForm.value}
									onChange={({ target: { value } }) =>
										setAddForm((prev) => ({ ...prev, value }))
									}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button type="submit" onClick={handleAdd}>
								Save Entry
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>

			<Card className="bg-card/50 py-0 flex-1 flex flex-col min-h-0">
				<ScrollArea className="rounded-t-lg flex-1 w-full max-w-full">
					<Table className="table-fixed w-full min-w-[700px]">
						<TableHeader className="bg-card sticky top-0 z-10 block w-full shadow-sm shrink-0">
							<TableRow className="flex w-full">
								<TableHead className="flew-1 flex items-center pl-4">
									Player
								</TableHead>
								<TableHead className="flew-1 flex items-center">Type</TableHead>
								<TableHead className="flex-[1.5] flex items-center">
									Identifier
								</TableHead>
								<TableHead className="flew-1 flex items-center">
									Added By
								</TableHead>
								<TableHead className="flex-[0.25] flex items-center justify-end pr-4">
									Actions
								</TableHead>
							</TableRow>
						</TableHeader>

						<TableBody className="block w-full">
							{loading ? (
								<TableRow className="flex w-full">
									<TableCell className="flex-1 p-8 text-center text-muted-foreground">
										Loading whitelist...
									</TableCell>
								</TableRow>
							) : entries.length === 0 ? (
								<TableRow className="flex w-full">
									<TableCell className="flex-1 p-8 text-center text-muted-foreground">
										No entries found.
									</TableCell>
								</TableRow>
							) : (
								entries.map((entry) => (
									<TableRow
										key={entry.id}
										className="flex w-full items-center py-2"
									>
										<TableCell className="flew-1 flex items-center pl-4 min-w-0">
											<div className="flex flex-col">
												<span className="font-medium truncate">
													{entry.playerName ?? 'Unlinked Player'}
												</span>
											</div>
										</TableCell>

										<TableCell className="flew-1 flex items-start justify-start">
											<Badge
												variant="outline"
												className="text-[10px] font-bold uppercase tracking-wider"
											>
												{entry.type}
											</Badge>
										</TableCell>

										<TableCell className="flex-[1.5] flex items-center font-mono text-zinc-500">
											<button
												type="button"
												title="Click to copy identifier"
												onClick={() => copyToClipboard(entry.value)}
											>
												{formatIdentifier(entry.value)}
											</button>
										</TableCell>

										<TableCell className="flew-1 flex items-center gap-2">
											{entry.addedByAdmin === 'system' ? (
												<>
													<Server className="h-4 w-4 text-primary shrink-0" />
													<span className="truncate">System</span>
												</>
											) : entry.addedByAdmin === 'deleted_admin' ? (
												<>
													<UserX2 className="h-4 w-4 text-red-500 shrink-0" />
													<span className="truncate">Deleted Admin</span>
												</>
											) : (
												<>
													<ShieldCheck className="h-4 w-4 text-blue-500 shrink-0" />
													<span className="truncate">{entry.addedByAdmin}</span>
												</>
											)}
										</TableCell>

										<TableCell className="flex-[0.25] flex items-center justify-end pr-4">
											<Button
												variant="ghost"
												size="icon"
												className="h-8 w-8 hover:text-red-500 hover:bg-red-500/10"
												onClick={() => handleDelete(entry.id)}
											>
												{isDeleting === entry.id ? (
													<Loader2 className="text-orange-500 animate-spin" />
												) : (
													<Trash2 className="h-4 w-4" />
												)}
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
		</div>
	);
}
