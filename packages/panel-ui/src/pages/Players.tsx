import { useEffect, useState } from 'react';
import { Users, ShieldBan, Search, ArrowUpDown } from 'lucide-react';
import type { Player } from '@fxmanager/types';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { QueryService } from '@/lib/query';
import { useDebounce } from '@/hooks/use-debounce';
import { formatDuration } from '@/lib/utils';

type SortBy = 'lastSeen' | 'firstSeen' | 'playtime';
type SortOrder = 'asc' | 'desc';

export default function Players() {
  const [players, setPlayers] = useState<Omit<Player, 'identifiers'>[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('lastSeen');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const debouncedSearch = useDebounce(search, 300);
  const loading = players === null;

  useEffect(() => {
    let cancelled = false;

    const params = new URLSearchParams({ sortBy, sortOrder });
    if (debouncedSearch) params.set('search', debouncedSearch);

    QueryService({ endpoint: `/players?${params}`, method: 'GET' })
      .then((data) => {
        if (!cancelled) setPlayers(Array.isArray(data) ? data : []);
      });

    return () => { cancelled = true; };
  }, [debouncedSearch, sortBy, sortOrder]);

  const toggleSortOrder = () => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h1 className="text-2xl font-bold">Players</h1>
        </div>
        <Badge variant="secondary">{players.length} total</Badge>
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

        <Button variant="outline" size="icon" onClick={toggleSortOrder} title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}>
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </div>

      <Card className="bg-card/50">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>First seen</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead>Playtime</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">Loading...</TableCell>
              </TableRow>
            ) : players.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {search ? `No players matching "${search}"` : 'No players found'}
                </TableCell>
              </TableRow>
            ) : (
              players.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    {p.name}
                    {p.isStaff && <Badge variant="link" className="ml-2 text-xs">Staff</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.firstSeen).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(p.lastSeen).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDuration(p.playtime)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 text-destructive hover:text-destructive">
                      <ShieldBan className="mr-1.5 h-3.5 w-3.5" /> Ban
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
