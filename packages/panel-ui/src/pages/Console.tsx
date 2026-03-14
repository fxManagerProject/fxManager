import { useEffect, useRef, useState } from 'react';
import { Terminal, SendHorizonal, ArrowRight } from 'lucide-react';
import Ansi from "ansi-to-react";
import { Card } from '@/components/ui/card';
// import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useConsoleSocket } from '@/hooks/use-ws-channels';
import type { ConsoleOutputEvent } from '@fxmanager/types';

function LogLine({ event }: { event: ConsoleOutputEvent }) {
  return (
    <div className="font-mono text-sm leading-tight whitespace-pre-wrap">
      <Ansi>{event.line}</Ansi>
    </div>
  );
}

export default function Console() {
  const { logs, sendCommand } = useConsoleSocket();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const submit = () => {
    const cmd = input.trim();
    if (!cmd) return;
    console.log('Sending command down ws', cmd);
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

  return (
    <div className="flex h-[calc(100vh-6rem)] flex-col gap-4">
      <div className="flex items-center gap-2">
        <Terminal className="h-5 w-5 text-primary" />
        <h1 className="text-2xl font-bold">Console</h1>
      </div>

      {/* ToDo:
       * Fix jumping around of the elements when logs update
       * Consider storing console output on client ? - server only stores 5k at a time
       */}
      <Card className="flex flex-1 flex-col bg-card/50">
        {/* <ScrollArea className="flex-1 p-4"> */}
        <div className="font-mono text-xs overflow-auto leading-relaxed">
          {logs.length === 0 ? (
            <span className="text-muted-foreground text-center">
              No output yet. Start the server to see logs.
            </span>
          ) : (
            logs.map((log) => <LogLine event={log} key={log.id} />)
          )}
          <div ref={bottomRef} />
        </div>
        {/* </ScrollArea> */}

        <div className="flex items-center gap-2 border-t p-3">
          <ArrowRight className="text-primary" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Enter server command..."
            className="flex-1 border-0 bg-transparent font-mono text-sm focus-visible:ring-0"
          />
          <Button size="icon" variant="ghost" onClick={submit} className="h-8 w-8 text-primary">
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
