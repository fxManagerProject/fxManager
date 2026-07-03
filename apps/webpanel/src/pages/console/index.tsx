import { PageHeader } from '@/components/page-header';
import { useConsoleSocket, useServerStateSocket } from '@/hooks/ws-channels';
import { useWSBase } from '@/hooks/ws-channels/use-ws-core';
import type { ProcessOutputLine } from '@fxmanager/shared/types';
import { Button } from '@fxmanager/ui/components/button';
import { Card } from '@fxmanager/ui/components/card';
import { Input } from '@fxmanager/ui/components/input';
import { ScrollArea, ScrollBar } from '@fxmanager/ui/components/scroll-area';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import Ansi from 'ansi-to-react';
import {
	ArrowDown,
	ArrowRight,
	Filter,
	LoaderCircle,
	SendHorizonal,
	Terminal,
	X,
} from 'lucide-react';
import {
	memo,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import './styles.css';

// biome-ignore lint/suspicious/noControlCharactersInRegex: strips ANSI color codes for filter matching
const ANSI_PATTERN = /\x1b\[[0-9;]*m/g;

const FOLLOW_THRESHOLD_PX = 40;

const LogLine = memo(function LogLine({ event }: { event: ProcessOutputLine }) {
	return (
		<div className="font-mono text-sm leading-tight whitespace-pre-wrap">
			<Ansi linkify className="ansi-item">
				{event.line}
			</Ansi>
		</div>
	);
});

export default function Console() {
	const [maxLines, setMaxLines] = useState<number>(200);
	const [following, setFollowing] = useState<boolean>(true);
	const { lines, sendCommand, clear } = useConsoleSocket({
		maxLines,
		suspendTrim: !following,
	});
	const {
		state: { status: serverStatus },
	} = useServerStateSocket();

	const { connected } = useWSBase();
	const [everConnected, setEverConnected] = useState<boolean>(false);

	const viewportRef = useRef<HTMLDivElement>(null);
	const followingRef = useRef(true);
	const lastSeqRef = useRef(-1);
	const pausedSeqRef = useRef(-1);
	const [input, setInput] = useState<string>('');
	const [history, setHistory] = useState<string[]>([]);
	const [histIdx, setHistIdx] = useState<number>(-1);
	const [filterOpen, setFilterOpen] = useState<boolean>(false);
	const [filter, setFilter] = useState<string>('');

	const visibleLines = useMemo(() => {
		const query = filter.trim().toLowerCase();
		if (!query) return lines;
		return lines.filter((log) =>
			log.line.replace(ANSI_PATTERN, '').toLowerCase().includes(query),
		);
	}, [lines, filter]);

	useEffect(() => {
		lastSeqRef.current = lines.length > 0 ? lines[lines.length - 1].seq : -1;
	}, [lines]);

	useEffect(() => {
		if (connected) setEverConnected(true);
	}, [connected]);

	const newCount = following
		? 0
		: visibleLines.filter((l) => l.seq > pausedSeqRef.current).length;

	const jumpToBottom = () => {
		followingRef.current = true;
		setFollowing(true);
		const el = viewportRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	};

	const toggleFilter = () => {
		if (filterOpen) setFilter('');
		setFilterOpen(!filterOpen);
	};

	const submit = () => {
		const cmd = input.trim();
		if (!cmd) return;
		setHistory((h) => [cmd, ...h].slice(0, 50));
		setHistIdx(-1);
		setInput('');

		if (cmd === 'clear' || cmd === 'cls') return clear();
		sendCommand(cmd);
		jumpToBottom();
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-pins the scroll whenever rendered output changes
	useLayoutEffect(() => {
		const el = viewportRef.current;
		if (!el || !followingRef.current) return;
		el.scrollTop = el.scrollHeight;
	}, [visibleLines]);

	useEffect(() => {
		const el = viewportRef.current;
		if (!el) return;

		const onScroll = () => {
			const nearBottom =
				el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOW_THRESHOLD_PX;
			if (followingRef.current && !nearBottom) {
				pausedSeqRef.current = lastSeqRef.current;
			}
			followingRef.current = nearBottom;
			setFollowing(nearBottom);
		};

		el.addEventListener('scroll', onScroll);
		return () => el.removeEventListener('scroll', onScroll);
	}, []);

	return (
		<div className="flex h-full flex-col gap-4">
			<PageHeader Icon={Terminal} title="Console" />

			<Card className="flex flex-1 flex-col min-h-0 pb-0 overflow-hidden gap-0.5">
				{!connected && (
					<div className="flex flex-none items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 pb-2 text-xs text-amber-500">
						<LoaderCircle className="h-3.5 w-3.5 animate-spin" />
						<span>
							{everConnected
								? 'Connection lost — reconnecting...'
								: 'Connecting...'}
						</span>
					</div>
				)}
				{filterOpen && (
					<div className="flex flex-none items-center gap-2 border-b px-3 pb-2">
						<Filter className="h-4 w-4 text-muted-foreground" />
						<Input
							value={filter}
							onChange={(e) => setFilter(e.target.value)}
							placeholder="Filter output..."
							className="flex-1 border-0 bg-transparent font-mono text-sm shadow-none outline-none focus-visible:ring-0"
						/>
						{filter.trim() && (
							<span className="text-xs text-muted-foreground whitespace-nowrap">
								{visibleLines.length}/{lines.length}
							</span>
						)}
						<Button
							size="icon"
							variant="ghost"
							onClick={toggleFilter}
							className="h-7 w-7 text-muted-foreground"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				)}
				<div className="relative flex-1 min-h-0">
					<ScrollArea className="h-full" viewportRef={viewportRef}>
						<div className="p-4 font-mono text-xs leading-relaxed">
							{lines.length === 0 ? (
								<p className="text-muted-foreground text-center py-4">
									{serverStatus === 'running'
										? 'No output to show.'
										: 'No output yet. Start the server to see logs.'}
								</p>
							) : visibleLines.length === 0 ? (
								<p className="text-muted-foreground text-center py-4">
									No lines match the filter.
								</p>
							) : (
								<div className="flex flex-col">
									{visibleLines.map((log) => (
										<LogLine event={log} key={log.seq} />
									))}
								</div>
							)}
						</div>
						<ScrollBar orientation="horizontal" />
					</ScrollArea>
					{!following && lines.length > 0 && (
						<Button
							size="sm"
							variant="secondary"
							onClick={jumpToBottom}
							className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 h-7 gap-1.5 rounded-full border px-3 text-xs shadow-md"
						>
							<ArrowDown className="h-3.5 w-3.5" />
							{newCount > 0
								? `${newCount} new line${newCount === 1 ? '' : 's'}`
								: 'Jump to bottom'}
						</Button>
					)}
				</div>

				<div className="flex flex-none items-center gap-4 border-t p-3 bg-background/50">
					<div className="flex flex-1 items-center gap-2">
						<ArrowRight className="h-4 w-4 text-primary" />
						<Input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={onKeyDown}
							disabled={serverStatus !== 'running' || !connected}
							placeholder={
								!connected
									? 'Reconnecting...'
									: serverStatus === 'running'
										? 'Enter server command...'
										: 'Server not running...'
							}
							className="flex-1 border-0 bg-transparent font-mono text-sm shadow-none outline-none focus-visible:ring-0"
						/>
					</div>

					<div className="flex items-center gap-4 border-l pl-4 h-6 border-muted">
						<Button
							size="icon"
							variant="ghost"
							onClick={toggleFilter}
							className={`h-7 w-7 ${
								filterOpen ? 'text-primary' : 'text-muted-foreground'
							}`}
						>
							<Filter className="h-4 w-4" />
						</Button>
						<div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
							<span className="whitespace-nowrap">Max lines:</span>
							<Select
								value={String(maxLines)}
								onValueChange={(val) => setMaxLines(Number(val))}
							>
								<SelectTrigger className="h-7 w-[80px] text-xs font-mono bg-background">
									<SelectValue placeholder="200" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="100">100</SelectItem>
									<SelectItem value="200">200</SelectItem>
									<SelectItem value="500">500</SelectItem>
									<SelectItem value="1000">1000</SelectItem>
								</SelectContent>
							</Select>
						</div>

					</div>

					<Button
						size="icon"
						variant="ghost"
						onClick={submit}
						disabled={serverStatus !== 'running' || !connected}
						className="h-8 w-8 text-primary"
					>
						<SendHorizonal className="h-4 w-4" />
					</Button>
				</div>
			</Card>
		</div>
	);
}
