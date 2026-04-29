import { PageHeader } from '@/components/page-header';
import { useConsoleSocket, useServerStateSocket } from '@/hooks/ws-channels';
import type { ProcessOutputLine } from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import { Card } from '@fxmanager/ui/components/card';
import { Input } from '@fxmanager/ui/components/input';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import Ansi from 'ansi-to-react';
import { ArrowRight, SendHorizonal, Terminal } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

function LogLine({ event }: { event: ProcessOutputLine }) {
	return (
		<div className="font-mono text-sm leading-tight whitespace-pre-wrap">
			<Ansi linkify className="ansi-item">
				{event.line}
			</Ansi>
		</div>
	);
}

export default function Console() {
	const { lines, sendCommand } = useConsoleSocket({ maxLines: 200 });
	const {
		state: { status: serverStatus },
	} = useServerStateSocket();

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

		const el = viewportRef.current;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
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
	}, []);

	return (
		<div className="flex h-[calc(100vh-2rem)] flex-col gap-4">
			<PageHeader Icon={Terminal} title="Console" />

			<Card className="flex flex-1 flex-col min-h-0 pb-0 overflow-hidden gap-0.5">
				<ScrollArea className="flex-1 min-h-0" viewportRef={viewportRef}>
					<div className="p-4 font-mono text-xs leading-relaxed">
						{lines.length === 0 ? (
							<p className="text-muted-foreground text-center py-4">
								No output yet. Start the server to see logs.
							</p>
						) : (
							<div className="flex flex-col">
								{lines.map((log, i) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: line indexes are immutable ?
									<LogLine event={log} key={i} />
								))}
							</div>
						)}
					</div>
					<ScrollBar orientation="horizontal" />
				</ScrollArea>

				<div className="flex flex-none items-center gap-2 border-t p-3 bg-background/50">
					<ArrowRight className="h-4 w-4 text-primary" />
					<Input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={onKeyDown}
						disabled={serverStatus !== 'running'}
						placeholder={
							serverStatus === 'running'
								? 'Enter server command...'
								: 'Server not running...'
						}
						className="flex-1 border-0 bg-transparent font-mono text-sm shadow-none outline-none focus-visible:ring-0"
					/>
					<Button
						size="icon"
						variant="ghost"
						onClick={submit}
						disabled={serverStatus !== 'running'}
						className="h-8 w-8 text-primary"
					>
						<SendHorizonal className="h-4 w-4" />
					</Button>
				</div>
			</Card>
		</div>
	);
}
