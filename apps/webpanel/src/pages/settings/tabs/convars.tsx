import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@fxmanager/ui/components/tabs';
import PoolSizesSection from './convars-pool-sizes';

type ConvarSection = {
	value: string;
	label: string;
	description: string;
	Component?: React.FC;
};

const CONVAR_SECTIONS = [
	{
		value: 'whitelist',
		label: 'Whitelist',
		description:
			'Convars that control server access and whitelisting, such as sv_lan.',
	},
	{
		value: 'security',
		label: 'Security',
		description:
			'Convars that harden the server, such as sv_scriptHookAllowed and sv_authMaxVariance.',
	},
	{
		value: 'pool-sizes',
		label: 'Pool Sizes',
		description:
			'Increase FXServer streaming and entity pool sizes at startup. Limits are fetched live from cfx.re.',
		Component: PoolSizesSection,
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

			{CONVAR_SECTIONS.map(({ value, label, description, Component }) => (
				<TabsContent key={value} value={value} className="pt-2">
					<div className="space-y-1">
						<h3 className="text-lg font-medium text-neutral-700 dark:text-neutral-200">
							{label}
						</h3>
						<p className="text-sm text-muted-foreground">{description}</p>
					</div>

					<div className="mt-4">
						{Component ? <Component /> : <SectionPlaceholder label={label} />}
					</div>
				</TabsContent>
			))}
		</Tabs>
	);
}
