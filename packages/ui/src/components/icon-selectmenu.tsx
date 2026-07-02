'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, HelpCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from '../lib/utils';
import { Button } from './button';
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from './command';
import { type IconName, lucideIconMap } from '../lib/icons';

interface IconPickerProps {
	value?: string;
	onChange: (value: string) => void;
	placeholder?: string;
}

export function IconPicker({
	value,
	onChange,
	placeholder = 'Select an icon...',
}: IconPickerProps) {
	const [open, setOpen] = React.useState(false);
	const [search, setSearch] = React.useState('');

	const iconNames = React.useMemo(() => Object.keys(lucideIconMap), []);

	const filteredIcons = React.useMemo(() => {
		if (!search) return iconNames.slice(0, 100);
		return iconNames
			.filter((name) => name.toLowerCase().includes(search.toLowerCase()))
			.slice(0, 100);
	}, [search, iconNames]);

	const SelectedIcon = value ? lucideIconMap[value as IconName] : null;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					role="combobox"
					aria-expanded={open}
					className="w-[250px] justify-between"
				>
					<div className="flex items-center gap-2 truncate">
						{SelectedIcon ? (
							<SelectedIcon className="h-4 w-4 shrink-0" />
						) : (
							<HelpCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
						)}
						<span className="truncate">{value || placeholder}</span>
					</div>
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>

			<PopoverContent className="w-[250px] p-0" align="start">
				<Command shouldFilter={false}>
					<CommandInput
						placeholder="Search icons..."
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList className="max-h-[300px] overflow-y-auto">
						<CommandEmpty>No icon found.</CommandEmpty>
						<CommandGroup>
							{filteredIcons.map((iconName) => {
								const IconComponent = lucideIconMap[iconName as IconName];
								return (
									<CommandItem
										key={iconName}
										value={iconName}
										onSelect={(currentValue) => {
											onChange(currentValue === value ? '' : currentValue);
											setOpen(false);
										}}
										className="flex items-center justify-between cursor-pointer"
									>
										<div className="flex items-center gap-2">
											<IconComponent className="h-4 w-4" />
											<span className="text-sm">{iconName}</span>
										</div>
										<Check
											className={cn(
												'h-4 w-4',
												value === iconName ? 'opacity-100' : 'opacity-0',
											)}
										/>
									</CommandItem>
								);
							})}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
