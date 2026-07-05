import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@fxmanager/ui/components/tabs';
import { ALLOWLIST_CONVARS, ANTICHEAT_CONVARS } from '@fxmanager/shared/constants';
import PoolSizesSection from './convars-pool-sizes';
import ConvarDefsSection from './convar-defs-section';

type ConvarSection = {
	value: string;
	label: string;
	description: string;
	render?: () => React.ReactNode;
};

const CONVAR_SECTIONS = [
	{
		value: 'whitelist',
		label: 'Whitelist',
		description:
			'Server-appearance convars that advertise your allowlist to players.',
		render: () => (
			<ConvarDefsSection
				defs={ALLOWLIST_CONVARS}
				endpoint="/convars/allowlist"
				label="Allowlist"
			/>
		),
	},
	{
		value: 'security',
		label: 'Security',
		description:
			'Convars that harden the server, such as sv_scriptHookAllowed and sv_authMaxVariance.',
	},
	{
		value: 'anticheat',
		label: 'Anticheat',
		description:
			'Harden the server against common cheats and griefing. Each convar is off unless you set it.',
		render: () => (
			<ConvarDefsSection
				defs={ANTICHEAT_CONVARS}
				endpoint="/convars/anticheat"
				label="Anticheat"
			/>
		),
	},
	{
		value: 'pool-sizes',
		label: 'Pool Sizes',
		description:
			'Increase FXServer streaming and entity pool sizes at startup. Limits are fetched live from cfx.re.',
		render: () => <PoolSizesSection />,
	},
] satisfies ConvarSection[];

function SectionPlaceholder({ label }: { label: string }) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
			<SlidersHorizontal className="size-6 text-muted-foreground" />
			<p className="text-sm font-medium">No convars configured yet</p>
			<p className="max-w-sm text-sm text-muted-foreground">
				Convars for the {label.toLowerCase()} category will appear here.
			</p>
		</div>
	);
}

export default function ConvarsTab() {
	const [section, setSection] = useState<string>(CONVAR_SECTIONS[0].value);

	return (
		<Tabs value={section} onValueChange={setSection}>
			<TabsList variant="line" className="justify-start flex-wrap h-auto">
				{CONVAR_SECTIONS.map(({ value, label }) => (
					<TabsTrigger key={value} value={value}>
						{label}
					</TabsTrigger>
				))}
			</TabsList>

			{CONVAR_SECTIONS.map(({ value, label, description, render }) => (
				<TabsContent key={value} value={value} className="pt-2">
					<div className="space-y-1">
						<h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-200">
							{label}
						</h3>
						<p className="text-sm text-muted-foreground">{description}</p>
					</div>

					<div className="mt-4">
						{render ? render() : <SectionPlaceholder label={label} />}
					</div>
				</TabsContent>
			))}
		</Tabs>
	);
}
