import { useWS } from '@/hooks/use-ws';
import type { ProcessOutputLine } from '@fxmanager/shared/types';
import Ansi from 'ansi-to-react';
import { useEffect, useState } from 'react';

function LogLine({ event }: { event: ProcessOutputLine }) {
  return (
    <div className="font-mono text-sm leading-tight whitespace-pre-wrap">
      <Ansi linkify className="ansi-item">
        {event.line}
      </Ansi>
    </div>
  );
}

export function Console() {
	const { subscribe, unsubscribe, on } = useWS();
	const [lines, setLines] = useState<ProcessOutputLine[]>([]);

	useEffect(() => {
		subscribe('console');

		const off = on<ProcessOutputLine>('console', 'line', (msg) => {
			console.log('new line received', msg);
			setLines((prev) => [...prev.slice(-499), msg.data]); // cap at 500 lines
		});

		return () => {
			off();
			unsubscribe('console');
		};
	}, []);

	return (
		<div>
			{lines.map((line, i) => (
				<LogLine key={i} event={line} />
			))}
		</div>
	);
}
