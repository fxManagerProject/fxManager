import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, ExternalLink, Hammer, StickyNote } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueryService } from '@/lib/query';
import type { ApiResponse, Player } from '@fxmanager/types';
import { computeExpiry, formatDate, initials } from '@/lib/utils';

// region types

export type ActionTab = 'warn' | 'kick' | 'ban' | 'note';

export interface PlayerActionSheetProps {
  player: Pick<Player, 'id' | 'name' | 'isStaff'> | null;
  open: boolean;
  defaultTab?: ActionTab;
  onClose: () => void;
  onSuccess?: (action: ActionTab, playerId: number) => void;
}

interface WarnForm {
  reason: string;
}
interface KickForm {
  reason: string;
}
interface BanForm {
  reason: string;
  duration: string;
  unit: 'hours' | 'days' | 'weeks' | 'permanent';
}
interface NoteForm {
  content: string;
}

// region action tabs

function WarnTab({
  playerId,
  onSuccess,
}: {
  playerId: number;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<WarnForm>({ reason: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.reason.trim()) return;
    setLoading(true);
    try {
      const res = await QueryService<ApiResponse>({
        endpoint: `/players/${playerId}/warn`,
        method: 'POST',
        body: form,
      });
      if (res.success) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-between h-full gap-4">
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Textarea
          placeholder="Describe the rule violation..."
          value={form.reason}
          onChange={(e) => setForm({ reason: e.target.value })}
          className="min-h-[200px] max-h-[200px] resize-none"
        />
      </div>
      <Button
        className="w-full"
        variant="outline"
        disabled={!form.reason.trim() || loading}
        onClick={handleSubmit}
      >
        <AlertTriangle className="h-4 w-4" />
        {loading ? 'Issuing...' : 'Issue warning'}
      </Button>
    </div>
  );
}

function KickTab({
  playerId,
  onSuccess,
}: {
  playerId: number;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<KickForm>({ reason: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.reason.trim()) return;
    setLoading(true);
    try {
      const res = await QueryService<ApiResponse>({
        endpoint: `/players/${playerId}/kick`,
        method: 'POST',
        body: form,
      });
      if (res.success) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-between h-full gap-4">
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Textarea
          placeholder="Reason for kick..."
          value={form.reason}
          onChange={(e) => setForm({ reason: e.target.value })}
          className="min-h-[200px] max-h-[200px] resize-none"
        />
      </div>
      <Button
        className="w-full"
        variant="outline"
        disabled={!form.reason.trim() || loading}
        onClick={handleSubmit}
      >
        <Hammer className="h-4 w-4" />
        {loading ? 'Kicking...' : 'Kick player'}
      </Button>
    </div>
  );
}

function BanTab({
  playerId,
  onSuccess,
}: {
  playerId: number;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<BanForm>({
    reason: '',
    duration: '',
    unit: 'permanent',
  });
  const [loading, setLoading] = useState(false);

  const isPermanent = form.unit === 'permanent';

  const handleSubmit = async () => {
    if (!form.reason.trim()) return;
    setLoading(true);
    try {
      const payload = {
        reason: form.reason,
        expiresAt: isPermanent
          ? null
          : computeExpiry(Number(form.duration), form.unit as 'hours' | 'days' | 'weeks'),
      };
      const res = await QueryService<ApiResponse>({
        endpoint: `/players/${playerId}/ban`,
        method: 'POST',
        body: payload,
      });
      if (res.success) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-between h-full gap-4">
      <div className="space-y-1.5">
        <Label>Reason</Label>
        <Textarea
          placeholder="Reason for ban..."
          value={form.reason}
          onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          className="h-[110px] resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Duration</Label>
          <Input
            type="number"
            min={1}
            placeholder="—"
            disabled={isPermanent}
            value={form.duration}
            onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Unit</Label>
          <Select
            value={form.unit}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, unit: v as BanForm['unit'], duration: '' }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="weeks">Weeks</SelectItem>
              <SelectItem value="permanent">Permanent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p
          className={`text-xs text-muted-foreground ${!isPermanent && form.duration ? 'opacity-100' : 'opacity-0'}`}
        >
          Expires:{' '}
          {formatDate(
            computeExpiry(Number(form.duration), form.unit as 'hours' | 'days' | 'weeks'),
          )}
        </p>
      </div>

      <Button
        className="w-full"
        variant="destructive"
        disabled={!form.reason.trim() || (!isPermanent && !form.duration) || loading}
        onClick={handleSubmit}
      >
        <Ban className="h-4 w-4" />
        {loading ? 'Banning...' : isPermanent ? 'Issue permanent ban' : 'Issue ban'}
      </Button>
    </div>
  );
}

function NoteTab({
  playerId,
  onSuccess,
}: {
  playerId: number;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<NoteForm>({ content: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!form.content.trim()) return;
    setLoading(true);
    try {
      const res = await QueryService<ApiResponse>({
        endpoint: `/players/${playerId}/notes`,
        method: 'POST',
        body: form,
      });
      if (res.success) onSuccess();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col justify-between h-full gap-4">
      <div className="space-y-1.5">
        <Label>Note</Label>
        <Textarea
          placeholder="Internal note about this player..."
          value={form.content}
          onChange={(e) => setForm({ content: e.target.value })}
          className="min-h-[200px] max-h-[200px] resize-none"
        />
      </div>
      <Button
        className="w-full"
        variant="outline"
        disabled={!form.content.trim() || loading}
        onClick={handleSubmit}
      >
        <StickyNote className="h-4 w-4" />
        {loading ? 'Saving...' : 'Save note'}
      </Button>
    </div>
  );
}

// region main component

export function PlayerActionDialog({
  player,
  open,
  defaultTab = 'warn',
  onClose,
  onSuccess,
}: PlayerActionSheetProps) {
  const [tab, setTab] = useState<ActionTab>(defaultTab);

  if (!player) return null;

  const handleSuccess = (action: ActionTab) => {
    onSuccess?.(action, player.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex flex-col p-0 gap-0 sm:max-w-lg w-full h-[50vh]">
        <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="text-xs">{initials(player.name)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-sm font-semibold leading-none">
                  {player.name}
                </DialogTitle>
                {player.isStaff && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    Staff
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Player #{player.id}</p>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as ActionTab)}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="w-full justify-start flex-wrap rounded-none pb-0" variant="line">
            {(['warn', 'kick', 'ban', 'note'] as const).map((value) => {
              const icons = { warn: AlertTriangle, kick: Hammer, ban: Ban, note: StickyNote };
              const labels = { warn: 'Warn', kick: 'Kick', ban: 'Ban', note: 'Note' };
              const Icon = icons[value];
              return (
                <TabsTrigger key={value} value={value}>
                  <Icon className="h-3.5 w-3.5" />
                  {labels[value]}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <div className="flex-1 overflow-y-auto min-h-0">
            <TabsContent value="warn" className="p-4 mt-0 h-full">
              <WarnTab playerId={player.id} onSuccess={() => handleSuccess('warn')} />
            </TabsContent>
            <TabsContent value="kick" className="p-4 mt-0 h-full">
              <KickTab playerId={player.id} onSuccess={() => handleSuccess('kick')} />
            </TabsContent>
            <TabsContent value="ban" className="p-4 mt-0 h-full">
              <BanTab playerId={player.id} onSuccess={() => handleSuccess('ban')} />
            </TabsContent>
            <TabsContent value="note" className="p-4 mt-0 h-full">
              <NoteTab playerId={player.id} onSuccess={() => handleSuccess('note')} />
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-4 py-3 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            asChild
          >
            <Link to={`/players/${player.id}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              View full profile
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
