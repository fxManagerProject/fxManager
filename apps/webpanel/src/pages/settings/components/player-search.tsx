import { Check, ChevronsUpDown, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@fxmanager/ui/components/button';
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from '@fxmanager/ui/components/popover';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@fxmanager/ui/components/command';
import { cn } from '@fxmanager/ui/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { QueryService } from '@/lib/query';
import type { PaginatedResponse, Player } from '@fxmanager/shared/types';
import type { AdminProfile } from '@fxmanager/database/types';

type PlayerOption = Omit<Player, 'identifiers'>;

interface PlayerSearchProps {
	value: AdminProfile['playerId'];
	onChange: (playerId: AdminProfile['playerId']) => void;
	trigger?: React.ReactNode;
	align?: 'start' | 'center' | 'end';
}

export function PlayerSearch({
	value,
	onChange,
	trigger,
	align,
}: PlayerSearchProps) {
	const [open, setOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [players, setPlayers] = useState<PlayerOption[]>([]);
	const [loadingPlayers, setLoadingPlayers] = useState(false);

	const debouncedSearch = useDebounce(searchTerm, 500);

	useEffect(() => {
		let cancelled = false;
		const params = new URLSearchParams({
			sortBy: 'lastSeen',
			sortOrder: 'asc',
			page: '1',
			pageSize: '5',
		});
		if (debouncedSearch) params.set('search', debouncedSearch);
		setLoadingPlayers(true);
		QueryService<PaginatedResponse<PlayerOption>>({
			endpoint: `/players?${params.toString()}`,
			method: 'GET',
		}).then((response) => {
			if (cancelled) return;
			setPlayers(response.items);
			setLoadingPlayers(false);
		});
		return () => {
			cancelled = true;
		};
	}, [debouncedSearch]);

	const selectedPlayer = players.find((p) => p.id === value);
	const displayLabel = value
		? (selectedPlayer?.name ?? `ID: ${value}`)
		: 'Search for a player...';

	const defaultTrigger = (
		<Button
			variant="outline"
			role="combobox"
			aria-expanded={open}
			className="w-full justify-between font-normal"
		>
			{displayLabel}
			<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
		</Button>
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>{trigger ?? defaultTrigger}</PopoverTrigger>
			<PopoverContent
				className="w-72 p-0"
				style={
					!trigger ? { width: 'var(--radix-popover-trigger-width)' } : undefined
				}
				align={align ?? 'start'}
			>
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Type username or license..."
						value={searchTerm}
						onValueChange={setSearchTerm}
					/>
					<CommandList>
						{loadingPlayers && (
							<CommandEmpty>
								<Loader2 className="h-4 w-4 animate-spin mr-2 inline" />
								<span className="text-sm text-muted-foreground">
									Searching...
								</span>
							</CommandEmpty>
						)}
						{!loadingPlayers &&
							players.length === 0 &&
							searchTerm.length > 0 && (
								<CommandEmpty>No player found.</CommandEmpty>
							)}
						<CommandGroup>
							{players.map((player) => (
								<CommandItem
									key={player.id}
									value={player.name}
									onSelect={() => {
										onChange(player.id);
										setOpen(false);
									}}
								>
									<Check
										className={cn(
											'mr-2 h-4 w-4',
											value === player.id ? 'opacity-100' : 'opacity-0',
										)}
									/>
									<div className="flex flex-1 flex-row justify-between items-center">
										<span>{player.name}</span>
										<span className="text-muted-foreground">
											(ID: {player.id})
										</span>
									</div>
								</CommandItem>
							))}
							<CommandItem
								value="None"
								onSelect={() => {
									onChange(null);
									setOpen(false);
								}}
							>
								<Check
									className={cn(
										'mr-2 h-4 w-4',
										!value ? 'opacity-100' : 'opacity-0',
									)}
								/>
								None
							</CommandItem>
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
