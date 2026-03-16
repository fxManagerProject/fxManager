import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, Ban, FileText, Flag, Hammer, StickyNote } from 'lucide-react';
import type { PlayerProfile } from '@fxmanager/types';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function BansTab({ bans }: { bans: PlayerProfile['punishments']['bans'] }) {
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

export function WarnsTab({ warns }: { warns: PlayerProfile['punishments']['warns'] }) {
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

export function KicksTab({ kicks }: { kicks: PlayerProfile['punishments']['kicks'] }) {
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

export function ReportsTab({ reports }: { reports: PlayerProfile['reports'] }) {
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

export function NotesTab({ notes }: { notes: PlayerProfile['notes'] }) {
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

export function EmptyState({
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

export function AdminProfile({ adminProfile }: { adminProfile: PlayerProfile['adminProfile'] }) {
  if (!adminProfile) return null;

  return (
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
            <p className="font-medium">{adminProfile.username}</p>
          </div>
          {adminProfile.createdAt && (
            <div>
              <p className="text-muted-foreground text-xs">Admin since</p>
              <p className="font-medium">{formatDate(adminProfile.createdAt)}</p>
            </div>
          )}
          {adminProfile.lastLoginAt && (
            <div>
              <p className="text-muted-foreground text-xs">Last login</p>
              <p className="font-medium">{formatDate(adminProfile.lastLoginAt)}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
