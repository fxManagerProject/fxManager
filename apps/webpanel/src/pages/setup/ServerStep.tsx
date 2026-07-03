import { useState } from 'react';
import {
	InfoIcon,
	ArrowRight,
	CheckCircle2,
	XCircle,
	ScanSearch,
} from 'lucide-react';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { Button } from '@fxmanager/ui/components/button';
import { Alert, AlertDescription } from '@fxmanager/ui/components/alert';
import { Spinner } from '@fxmanager/ui/components/spinner';
import type { SetupFormData } from './types';
import { getSetupToken } from './setup-token';

interface ServerStepProps {
	formData: SetupFormData;
	onChange: <K extends keyof SetupFormData>(
		field: K,
		value: SetupFormData[K],
	) => void;
	onNext: () => void;
}

interface DetectData {
	executable: string;
	dataPath: string;
	cfgPath: string;
	found: { executable: boolean; dataPath: boolean; cfg: boolean };
}

function DetectedPath({
	label,
	value,
	found,
}: {
	label: string;
	value: string;
	found: boolean;
}) {
	return (
		<div className="flex items-start gap-2 text-sm">
			{found ? (
				<CheckCircle2 className="size-4 mt-0.5 text-primary shrink-0" />
			) : (
				<XCircle className="size-4 mt-0.5 text-destructive shrink-0" />
			)}
			<div className="min-w-0">
				<p className="font-medium">{label}</p>
				<p className="text-xs text-muted-foreground font-mono break-all">
					{found ? value : 'not found'}
				</p>
			</div>
		</div>
	);
}

export function ServerStep({ formData, onChange, onNext }: ServerStepProps) {
	const [detecting, setDetecting] = useState(false);
	const [detect, setDetect] = useState<DetectData | null>(null);
	const [detectError, setDetectError] = useState<string | null>(null);

	const detectedOk =
		!!detect && detect.found.executable && detect.found.dataPath;

	async function runDetect() {
		setDetecting(true);
		setDetectError(null);
		try {
			const res = await fetch('/api/setup/detect', {
				credentials: 'include',
				headers: { 'x-setup-token': getSetupToken() },
			});
			const payload = (await res.json().catch(() => null)) as
				| { success: true; data: DetectData }
				| { success: false; error: string }
				| null;

			if (!res.ok || !payload?.success) {
				throw new Error(
					(payload && !payload.success && payload.error) || 'Detection failed.',
				);
			}

			const data = payload.data;
			setDetect(data);
			if (data.found.executable) onChange('fxserverPath', data.executable);
			if (data.found.dataPath) onChange('resourcePath', data.dataPath);
		} catch (err) {
			setDetect(null);
			setDetectError((err as Error).message);
		} finally {
			setDetecting(false);
		}
	}

	function selectManual() {
		onChange('serverSetupMethod', 'manual');
	}

	function selectAutomatic() {
		onChange('serverSetupMethod', 'installer');
		if (!detecting) runDetect();
	}

	return (
		<div className="flex flex-col gap-6 py-4 w-full">
			<div className="space-y-1">
				<h3 className="text-base font-semibold">
					Instance Core Path Definitions
				</h3>
				<p className="text-xs text-muted-foreground">
					Point fxManager at your FXServer binary and data folder — or let it
					auto-detect a default Docker install.
				</p>
			</div>

			<div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit">
				<Button
					type="button"
					variant={
						formData.serverSetupMethod === 'manual' ? 'default' : 'ghost'
					}
					size="sm"
					onClick={selectManual}
				>
					Local Directory Binding
				</Button>
				<Button
					type="button"
					variant={
						formData.serverSetupMethod === 'installer' ? 'default' : 'ghost'
					}
					size="sm"
					onClick={selectAutomatic}
				>
					Auto-detect (Docker)
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
				<div className="flex flex-col gap-4">
					{detecting && (
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Spinner className="size-4" /> Scanning for an existing install...
						</div>
					)}

					{!detecting && detect && (
						<>
							<div className="flex flex-col gap-3 rounded-lg border p-4">
								<DetectedPath
									label="FXServer binary"
									value={detect.executable}
									found={detect.found.executable}
								/>
								<DetectedPath
									label="Data folder"
									value={detect.dataPath}
									found={detect.found.dataPath}
								/>
								<DetectedPath
									label="server.cfg"
									value={detect.cfgPath}
									found={detect.found.cfg}
								/>
							</div>

							{detectedOk ? (
								<Alert>
									<CheckCircle2 className="size-4 text-primary" />
									<AlertDescription>
										Detected your install — these paths will be used.
									</AlertDescription>
								</Alert>
							) : (
								<Alert>
									<InfoIcon className="size-4 text-amber-500" />
									<AlertDescription>
										Couldn't find the default files. Switch to{' '}
										<span className="font-medium text-foreground">
											Local Directory Binding
										</span>{' '}
										to enter the paths manually.
									</AlertDescription>
								</Alert>
							)}
						</>
					)}

					{!detecting && detectError && (
						<p className="text-sm text-destructive">{detectError}</p>
					)}

					<Button
						type="button"
						variant="outline"
						size="sm"
						className="w-fit gap-2"
						disabled={detecting}
						onClick={runDetect}
					>
						<ScanSearch className="size-4" />
						{detect || detectError ? 'Re-scan' : 'Scan'}
					</Button>
				</div>
			)}

			<div className="flex justify-end pt-4 border-t mt-2">
				<Button
					type="button"
					className="gap-2 w-full md:w-auto px-5"
					onClick={onNext}
					disabled={formData.serverSetupMethod === 'installer' && !detectedOk}
				>
					Continue <ArrowRight className="size-4" />
				</Button>
			</div>
		</div>
	);
}
