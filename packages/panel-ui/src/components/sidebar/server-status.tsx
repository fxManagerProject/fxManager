import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuButton,
  useSidebar,
} from '@/components/ui/sidebar';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useServerStateSocket } from '@/hooks/use-ws-channels';
import { STATUS_VARIANT } from '@/static/server-state';
import { formatUptime } from '@/lib/utils';
import { Button } from '../ui/button';
import type { ServerStatus } from '@fxmanager/types';
import { HandleServerAction } from '@/lib/query';
import { MonitorCog, Play, RefreshCw, Square, type LucideIcon } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

interface ActionButtonProps {
  Icon: LucideIcon;
  colour: string;
  action: 'start' | 'stop' | 'restart';
  disabled: boolean;
  tooltip?: string;
}

function ActionButton({ Icon, colour, action, disabled = false, tooltip }: ActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => HandleServerAction(action)}
          className={`flex-1 border-${colour}/30 text-${colour} hover:bg-${colour}/10 disabled:opacity-40`}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      {tooltip && (
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export function ServerStatusCard() {
  const {
    state: { serverState },
  } = useServerStateSocket();
  const { state, setOpen } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const status = serverState?.status ?? ('stopped' satisfies ServerStatus);
  const isRunning = status === 'running';
  const canStart = status === 'stopped' || status === 'crashed';

  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center">
        <SidebarMenuButton tooltip="View server status" onClick={() => setOpen(true)}>
          <MonitorCog />
        </SidebarMenuButton>
      </div>
    );
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Server Status</SidebarGroupLabel>
      <Card>
        <CardContent className="space-y-3">
          <div className="flex flex-row justify-between">
            <p>Status</p>
            <Badge variant={STATUS_VARIANT[status]}>{status}</Badge>
          </div>
          <div className="flex flex-row justify-between">
            <p>Uptime</p>
            <p>{serverState?.startedAt ? formatUptime(serverState.startedAt, false) : 'N/A'}</p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium">Actions</p>
            <div className="flex w-full flex-row gap-2">
              <ActionButton
                action="start"
                disabled={!canStart}
                colour="green-400"
                Icon={Play}
                tooltip="Start server"
              />
              <ActionButton
                action="stop"
                disabled={!isRunning}
                colour="destructive"
                Icon={Square}
                tooltip="Stop server"
              />
              <ActionButton
                action="restart"
                disabled={!isRunning}
                colour="primary"
                Icon={RefreshCw}
                tooltip="Restart server"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </SidebarGroup>
  );
}
