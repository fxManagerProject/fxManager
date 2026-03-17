import { useEffect, useRef, useState } from 'react';
import { Terminal, SendHorizonal, ArrowRight } from 'lucide-react';
import Ansi from 'ansi-to-react';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConsoleSocket, useServerStateSocket } from '@/hooks/use-ws-channels';
import type { ConsoleOutputEvent } from '@fxmanager/types';
import { PageHeader } from '@/components/page-header';

function LogLine({ event }: { event: ConsoleOutputEvent }) {
  return (
    <div className="font-mono text-sm leading-tight whitespace-pre-wrap">
      <Ansi linkify className="ansi-item">
        {event.line}
      </Ansi>
    </div>
  );
}

export default function Console() {
  const {
    state: { serverState },
  } = useServerStateSocket();
  const { logs, sendCommand } = useConsoleSocket();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    sendCommand(cmd);
    setHistory((h) => [cmd, ...h].slice(0, 50));
    setHistIdx(-1);
    setInput('');
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') return submit();
    if (e.key === 'ArrowUp') {
      const idx = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(idx);
      setInput(history[idx] ?? '');
    }
    if (e.key === 'ArrowDown') {
      const idx = Math.max(histIdx - 1, -1);
      setHistIdx(idx);
      setInput(idx === -1 ? '' : history[idx]);
    }
  };

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
      <PageHeader Icon={Terminal} title="Console" />

      <Card className="flex flex-1 flex-col min-h-0 pb-0 overflow-hidden">
        <ScrollArea className="flex-1 min-h-0" viewportRef={viewportRef}>
          <div className="p-4 font-mono text-xs leading-relaxed">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No output yet. Start the server to see logs.
              </p>
            ) : (
              <div className="flex flex-col">
                {logs.map((log) => (
                  <LogLine event={log as ConsoleOutputEvent} key={log.id} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex flex-none items-center gap-2 border-t p-3 bg-background/50">
          <ArrowRight className="h-4 w-4 text-primary" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={serverState?.status !== 'running'}
            placeholder={
              serverState?.status === 'running'
                ? 'Enter server command...'
                : 'Server not running...'
            }
            className="flex-1 border-0 bg-transparent font-mono text-sm shadow-none outline-none focus-visible:ring-0"
          />
          <Button size="icon" variant="ghost" onClick={submit} className="h-8 w-8 text-primary">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
