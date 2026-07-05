import { ArrowUpDown, Plus, Search, Settings, ShieldUser } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import { useEffect, useState } from 'react';
import { QueryService } from '@/lib/query';
import { toast } from 'sonner';
import type { BaseAdminUser, PaginatedResponse } from '@fxmanager/shared/types';
import { Input } from '@fxmanager/ui/components/input';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@fxmanager/ui/components/table';
import { Card } from '@fxmanager/ui/components/card';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@fxmanager/ui/components/button';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import PageSizeSelector from '@/components/page-size-selector';
import PageSelector from '@/components/page-selector';
import { GroupBadge } from '@/components/group-badge';

type SortBy = 'createdAt' | 'lastLoginAt';
type SortOrder = 'asc' | 'desc';

export default function AdminManagementList() {
	const [searchParams, setSearchParams] = useSearchParams();
	const navigate = useNavigate();

	const [admins, setAdmins] = useState<BaseAdminUser[] | null>(null);
	const [total, setTotal] = useState(0);

	const search = searchParams.get('search') ?? '';
	const sortBy = (searchParams.get('sortBy') as SortBy) ?? 'lastLoginAt';
	const sortOrder = (searchParams.get('sortOrder') as SortOrder) ?? 'desc';
	const page = Number(searchParams.get('page') ?? 1);
	const pageSize = Number(searchParams.get('pageSize') ?? 20);

	const debouncedSearch = useDebounce(search, 300);
	const loading = admins === null;

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

		QueryService<PaginatedResponse<BaseAdminUser>>({
			endpoint: `/settings/admins?${params.toString()}`,
			method: 'GET',
		})
			.then((response) => {
				if (cancelled) return;

				const { items, total: newTotal } = response;

				setAdmins(items);
				setTotal(newTotal);
			})
			.catch((err) => {
				toast.error(err.message);
			});

		return () => {
			cancelled = true;
		};
	}, [debouncedSearch, sortBy, sortOrder, page, pageSize]);

	return (
		<div className="flex flex-col gap-6 h-full p-4">
			<PageHeader
				Icon={ShieldUser}
				title="Admin Management"
				description="Manage admin accounts."
			/>

			<div className="flex flex-row justify-between">
				<div className="flex items-center gap-3">
					<div className="relative flex-1 max-w-sm">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search by name..."
							value={search}
							onChange={(e) => setSearch(e.target.value)}
							className="pl-8"
						/>
					</div>

					<Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
						<SelectTrigger className="lg:w-40">
							<SelectValue placeholder="Sort by" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="createdAt">Created at</SelectItem>
							<SelectItem value="lastLoginAt">Last login</SelectItem>
						</SelectContent>
					</Select>

					<Button
						variant="outline"
						onClick={toggleSortOrder}
						className="lg:w-40 justify-between"
					>
						<span className="hidden lg:block">
							{sortOrder === 'asc' ? 'Ascending' : 'Descending'}
						</span>
						<ArrowUpDown className="h-4 w-4" />
					</Button>
				</div>

				<Button asChild>
					<Link to="/settings/admins/create">
						<Plus />
						<span className="hidden lg:block">Create User</span>
					</Link>
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
								<TableHead className="flex-1 flex items-center">Role</TableHead>
								<TableHead className="flex-1 flex items-center">
									Created At
								</TableHead>
								<TableHead className="flex-1 flex items-center">
									Last Login
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
							) : admins.length === 0 ? (
								<TableRow className="flex w-full">
									<TableCell
										colSpan={5}
										className="flex-1 text-center text-muted-foreground"
									>
										{search
											? `No admins matching "${search}"`
											: 'No admins found'}
									</TableCell>
								</TableRow>
							) : (
								admins.map((a) => (
									<TableRow
										key={a.id}
										className="flex w-full items-center"
										onClick={() => navigate(`/settings/admins/${a.id}`)}
									>
										<TableCell className="font-medium pl-4 flex-1 flex items-center gap-2 truncate">
											<span>{a.username}</span>
										</TableCell>
										<TableCell className="flex-1 flex items-center gap-2 truncate">
											{a.group && <GroupBadge group={a.group} />}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground flex-1">
											{new Date(a.createdAt).toLocaleDateString()}
										</TableCell>
										<TableCell className="text-sm text-muted-foreground flex-1">
											{a.lastLoginAt
												? new Date(a.lastLoginAt).toLocaleString()
												: 'N/A'}
										</TableCell>
										<TableCell className="w-70 flex justify-around">
											<Button
												size="sm"
												variant="outline"
												className="h-7 w-37"
												onClick={() => {}}
											>
												<Settings className="mr-1.5 h-3.5 w-3.5" /> Edit
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
