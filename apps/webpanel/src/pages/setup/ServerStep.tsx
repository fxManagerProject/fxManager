import { InfoIcon, ArrowRight } from 'lucide-react';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { Button } from '@fxmanager/ui/components/button';
import {
	Alert,
	AlertTitle,
	AlertDescription,
} from '@fxmanager/ui/components/alert';
import type { SetupFormData } from './types';

interface ServerStepProps {
	formData: SetupFormData;
	onChange: <K extends keyof SetupFormData>(
		field: K,
		value: SetupFormData[K],
	) => void;
	onNext: () => void;
}

export function ServerStep({ formData, onChange, onNext }: ServerStepProps) {
	return (
		<div className="flex flex-col gap-6 py-4 w-full">
			<div className="space-y-1">
				<h3 className="text-base font-semibold">
					Instance Core Path Definitions
				</h3>
				<p className="text-xs text-muted-foreground">
					Map local target routes or choose clean remote binary setups.
				</p>
			</div>

			<div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit">
				<Button
					type="button"
					variant={
						formData.serverSetupMethod === 'manual' ? 'default' : 'ghost'
					}
					size="sm"
					onClick={() => onChange('serverSetupMethod', 'manual')}
				>
					Local Directory Binding
				</Button>
				<Button
					type="button"
					variant={
						formData.serverSetupMethod === 'installer' ? 'default' : 'ghost'
					}
					size="sm"
					onClick={() => onChange('serverSetupMethod', 'installer')}
				>
					Clean Automated Install
				</Button>
			</div>

			{formData.serverSetupMethod === 'manual' ? (
				<div className="flex flex-col gap-4">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="fxserverPath">FXServer Absolute Path</Label>
						<Input
							id="fxserverPath"
							type="text"
							placeholder="/home/fxserver/alpine/opt/cfx/fxserver"
							value={formData.fxserverPath}
							onChange={(e) => onChange('fxserverPath', e.target.value)}
							required
						/>
					</div>

					<div className="flex flex-col gap-1.5">
						<Label htmlFor="resourcePath">Data Resources Folder Path</Label>
						<Input
							id="resourcePath"
							type="text"
							placeholder="/home/fxserver/server-data/resources"
							value={formData.resourcePath}
							onChange={(e) => onChange('resourcePath', e.target.value)}
							required
						/>
					</div>
				</div>
			) : (
				<div>
					<Alert>
						<AlertTitle className="flex items-center gap-2 text-amber-500 font-semibold">
							<InfoIcon className="size-4" />
							Not Implemented
						</AlertTitle>
						<AlertDescription>
							<p className="mb-2 text-muted-foreground">
								This is a placeholder component as this feature is not yet
								implemented.
							</p>
							<p className="font-medium">What will be here:</p>
							<ul className="list-disc pl-5 mt-1 text-xs space-y-1">
								<li>Artifact Download & Linux/Windows Extractors</li>
								<li>txAdmin Recipe Deployer Hooks</li>
							</ul>
						</AlertDescription>
					</Alert>
				</div>
			)}

			<div className="flex justify-end pt-4 border-t mt-2">
				<Button
					type="button"
					className="gap-2 w-full md:w-auto px-5"
					onClick={onNext}
					disabled={formData.serverSetupMethod !== 'manual'}
				>
					Continue <ArrowRight className="size-4" />
				</Button>
			</div>
		</div>
	);
}
