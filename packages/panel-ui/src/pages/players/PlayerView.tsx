import { QueryService } from '@/lib/query';
import { ApiError, type ApiResponse, type PlayerProfile } from '@fxmanager/types';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  Clock,
  FileText,
  Fingerprint,
  Flag,
  Hammer,
  ShieldCheck,
  StickyNote,
  User,
} from 'lucide-react';
import { formatDate, formatDuration, initials } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';

// region components

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Card className="flex-1 min-w-[140px]">
      <CardContent className="pt-4 pb-4 flex items-center gap-3">
        <div className="rounded-md bg-muted p-2 shrink-0">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="overflow-hidden">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-sm font-semibold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function BansTab({ bans }: { bans: PlayerProfile['punishments']['bans'] }) {
  if (!bans.length) return <EmptyState icon={Ban} message="No bans on record" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reason</TableHead>
          <TableHead>Issued by</TableHead>
          <TableHead>Expires</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {bans.map((ban) => (
          <TableRow key={ban.id}>
            <TableCell className="max-w-[240px] truncate">{ban.reason}</TableCell>
            <TableCell>{ban.issuedBy ?? 'System'}</TableCell>
            <TableCell>
              {ban.expiresAt ? (
                formatDate(ban.expiresAt)
              ) : (
                <Badge variant="destructive" className="text-xs">
                  Permanent
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDate(ban.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function WarnsTab({ warns }: { warns: PlayerProfile['punishments']['warns'] }) {
  if (!warns.length) return <EmptyState icon={AlertTriangle} message="No warnings on record" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reason</TableHead>
          <TableHead>Issued by</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {warns.map((warn) => (
          <TableRow key={warn.id}>
            <TableCell className="max-w-[300px] truncate">{warn.reason}</TableCell>
            <TableCell>{warn.issuedBy ?? 'System'}</TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDate(warn.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function KicksTab({ kicks }: { kicks: PlayerProfile['punishments']['kicks'] }) {
  if (!kicks.length) return <EmptyState icon={Hammer} message="No kicks on record" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reason</TableHead>
          <TableHead>Issued by</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kicks.map((kick) => (
          <TableRow key={kick.id}>
            <TableCell className="max-w-[300px] truncate">{kick.reason}</TableCell>
            <TableCell>{kick.issuedBy ?? 'System'}</TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDate(kick.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function ReportsTab({ reports }: { reports: PlayerProfile['reports'] }) {
  if (!reports.length) return <EmptyState icon={Flag} message="No reports found" />;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Description</TableHead>
          <TableHead>Reported by</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reports.map((report) => (
          <TableRow key={report.id}>
            <TableCell className="max-w-[260px] truncate">{report.description}</TableCell>
            <TableCell>{report.reportedBy}</TableCell>
            <TableCell>
              <Badge
                variant={report.status === 'open' ? 'secondary' : 'outline'}
                className="capitalize text-xs"
              >
                {report.status}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {formatDate(report.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function NotesTab({ notes }: { notes: PlayerProfile['notes'] }) {
  if (!notes.length) return <EmptyState icon={StickyNote} message="No notes added" />;
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <Card key={note.id}>
          <CardContent className="pt-4 pb-4">
            <p className="text-sm">{note.content}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Added by <span className="font-medium">{note.addedBy}</span> ·{' '}
              {formatDate(note.createdAt)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  message,
}: {
  icon: React.ElementType;
  message: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
      <Icon className="h-8 w-8 opacity-30" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      {/* header */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* stat cards */}
      <div className="flex gap-3 flex-wrap">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 flex-1 min-w-[140px] rounded-lg" />
        ))}
      </div>

      {/* tabs */}
      <Skeleton className="h-10 w-full rounded-md" />
      <Skeleton className="h-48 w-full rounded-lg" />
    </div>
  );
}

// region main component

export default function PlayerView() {
  const params = useParams<{ playerId: string }>();
  const [playerData, setPlayerData] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.playerId) return;

    QueryService<ApiResponse<PlayerProfile>>({
      endpoint: `/players/${params.playerId}`,
      method: 'GET',
    })
      .then((res) => {
        setError(null);
        if (res.success) {
          setPlayerData(res.data);
        } else {
          setError(res.error);
        }
      })
      .catch((err) => {
        console.error('Loading player failed', err.status, err.message);
        setError((err as ApiError).message ?? 'Failed to load player data.');
      })
      .finally(() => setLoading(false));
  }, [params.playerId]);

  if (loading) return <LoadingSkeleton />;

  if (error || !playerData) {
    return (
      <Card className="w-full mt-12">
        <CardContent className="py-6 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />

          <p className="font-semibold">Failed to load player</p>
          <p className="text-sm text-muted-foreground">{error ?? 'Player not found.'}</p>

          <Button variant="outline" size="sm" asChild>
            <Link to="/players">
              <ArrowLeft className="h-4 w-4" />
              Back to Players
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { punishments } = playerData;
  const totalPunishments =
    punishments.bans.length + punishments.warns.length + punishments.kicks.length;

  return (
    <ScrollArea className="h-[calc(100vh-5rem)]">
      <div className="space-y-6 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Avatar className="h-16 w-16 text-lg">
            <AvatarFallback>{initials(playerData.name)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold truncate">{playerData.name}</h1>
              {playerData.isStaff && (
                <Badge className="gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Staff
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">Player #{playerData.id}</p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-wrap gap-3">
          <StatCard icon={Clock} label="Playtime" value={formatDuration(playerData.playtime)} />
          <StatCard icon={User} label="First Seen" value={formatDate(playerData.firstSeen)} />
          <StatCard icon={User} label="Last Seen" value={formatDate(playerData.lastSeen)} />
          <StatCard
            icon={Hammer}
            label="Punishments"
            value={
              totalPunishments > 0 ? (
                <span className="text-destructive">{totalPunishments}</span>
              ) : (
                'None'
              )
            }
          />
        </div>

        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              Identifiers
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="flex flex-wrap gap-2">
              {Object.entries(playerData.identifiers).map(([key, value]) =>
                value ? (
                  <Badge key={key} variant="outline" className="font-mono text-xs">
                    {key}: {value}
                  </Badge>
                ) : null,
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="bans">
          <TabsList className="w-full justify-start flex-wrap h-auto">
            <TabsTrigger value="bans" className="gap-1.5">
              <Ban className="h-3.5 w-3.5" />
              Bans
              {punishments.bans.length > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs h-4">
                  {punishments.bans.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="warns" className="gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Warns
              {punishments.warns.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs h-4">
                  {punishments.warns.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="kicks" className="gap-1.5">
              <Hammer className="h-3.5 w-3.5" />
              Kicks
              {punishments.kicks.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs h-4">
                  {punishments.kicks.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5">
              <Flag className="h-3.5 w-3.5" />
              Reports
              {playerData.reports.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs h-4">
                  {playerData.reports.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1.5">
              <StickyNote className="h-3.5 w-3.5" />
              Notes
              {playerData.notes.length > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs h-4">
                  {playerData.notes.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="bans" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-auto">
                <BansTab bans={punishments.bans} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="warns" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-auto">
                <WarnsTab warns={punishments.warns} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="kicks" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-auto">
                <KicksTab kicks={punishments.kicks} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-auto">
                <ReportsTab reports={playerData.reports} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-4">
            <Card>
              <CardContent className="p-0 overflow-auto">
                <NotesTab notes={playerData.notes} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {playerData.adminProfile && (
          <Card>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Admin Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-1">
              <div className="flex gap-6 flex-wrap text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Username</p>
                  <p className="font-medium">{playerData.adminProfile.username}</p>
                </div>
                {playerData.adminProfile.createdAt && (
                  <div>
                    <p className="text-muted-foreground text-xs">Admin since</p>
                    <p className="font-medium">{formatDate(playerData.adminProfile.createdAt)}</p>
                  </div>
                )}
                {playerData.adminProfile.lastLoginAt && (
                  <div>
                    <p className="text-muted-foreground text-xs">Last login</p>
                    <p className="font-medium">{formatDate(playerData.adminProfile.lastLoginAt)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
