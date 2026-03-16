import { useEffect, useState } from 'react';
import { Users, Search, ArrowUpDown, Eye, ShieldAlert } from 'lucide-react';
import type { PaginatedResponse, Player } from '@fxmanager/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { QueryService } from '@/lib/query';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDuration } from '@/lib/utils';
import PageSizeSelector from '@/components/page-size-selector';
import PageSelector from '@/components/page-selector';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePlayerAction } from '@/hooks/use-player-actions';
import { PlayerActionDialog } from '@/components/player-actions-dialog';

type SortBy = 'lastSeen' | 'firstSeen' | 'playtime';
type SortOrder = 'asc' | 'desc';

export default function Players() {
  const [players, setPlayers] = useState<Omit<Player, 'identifiers'>[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('lastSeen');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { dialogOpen, dialogPlayer, dialogTab, openAction, closeAction } = usePlayerAction();
  const debouncedSearch = useDebounce(search, 300);
  const loading = players === null;

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({
      sortBy,
      sortOrder,
      page: page.toString(),
      pageSize: pageSize.toString(),
    });

    if (debouncedSearch) params.set('search', debouncedSearch);

    /* ToDo:
     * Consider storing params in localstorage so the user coming back has the same settings
     * Useful if looking through profiles to avoid reiterating a search over and over
     */

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

  useEffect(() => {
    const updatePage = () => setPage(1);
    updatePage();
  }, [debouncedSearch, sortBy, sortOrder]);

  const toggleSortOrder = () => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Players</h1>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
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

        <Button variant="outline" onClick={toggleSortOrder} className="w-40 justify-between">
          <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      {/* ToDo:
        find a solution for mobile display as this fucks up, options:
        * Dynamically display columns on mobile (only show active filter)
        * Don't show extra columns

      */}
      <Card className="bg-card/50 py-0">
        <div className="overflow-hidden rounded-t-lg">
          <Table className="table-fixed w-full">
            <TableHeader className="bg-card block w-full">
              <TableRow className="flex w-full">
                <TableHead className="pl-4 flex-1 flex items-center">Name</TableHead>
                <TableHead className="flex-1 flex items-center">First seen</TableHead>
                <TableHead className="flex-1 flex items-center">Last seen</TableHead>
                <TableHead className="flex-1 flex items-center">Playtime</TableHead>
                <TableHead className="w-70 flex items-center" />
              </TableRow>
            </TableHeader>
            <TableBody className="block w-full">
              <ScrollArea className="h-[65vh]">
                {loading ? (
                  <TableRow className="flex w-full">
                    <TableCell colSpan={5} className="flex-1 text-center text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : players.length === 0 ? (
                  <TableRow className="flex w-full">
                    <TableCell colSpan={5} className="flex-1 text-center text-muted-foreground">
                      {search ? `No players matching "${search}"` : 'No players found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  players.map((p) => (
                    <TableRow key={p.id} className="flex w-full items-center">
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
                        <Button size="sm" variant="outline" className="h-7 w-30" asChild>
                          <Link to={`/players/${p.id}`}>
                            <Eye className="mr-1.5 h-3.5 w-3.5" /> View Profile
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-20"
                          onClick={() => openAction(p)}
                        >
                          <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Actions
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </ScrollArea>
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-4 py-4 border-t border-border bg-card">
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
