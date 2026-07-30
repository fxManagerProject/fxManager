import { useState } from 'react';
import { Input } from '@fxmanager/ui/components/input';

export function PlayersSection() {
	const [query, setQuery] = useState('');

	return (
		<div className="flex flex-col gap-3">
			<Input
				placeholder="Search players by name or id…"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
			/>
			<div className="text-sm text-muted-foreground">
				{/* filter and render player rows here, using `query` */}
				Player list goes here.
			</div>
		</div>
	);
}
