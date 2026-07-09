import { useState } from 'react';
import {
	InfoIcon,
	ArrowRight,
	CheckCircle2,
	XCircle,
	ScanSearch,
	AlertTriangle,
} from 'lucide-react';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { Button } from '@fxmanager/ui/components/button';
import { Alert, AlertDescription } from '@fxmanager/ui/components/alert';
import { Spinner } from '@fxmanager/ui/components/spinner';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@fxmanager/ui/components/dialog';
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
	const [isChecking, setIsChecking] = useState(false);
	const [detect, setDetect] = useState<DetectData | null>(null);
	const [detectError, setDetectError] = useState<string | null>(null);

	const [missingFiles, setMissingFiles] = useState<{
		executable: boolean;
		dataPath: boolean;
		cfg: boolean;
	} | null>(null);

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

	async function runCheck(): Promise<DetectData['found'] | null> {
		setIsChecking(true);
		setDetectError(null);
		try {
			const res = await fetch('/api/setup/checkfiles', {
				method: 'POST',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/json',
					'x-setup-token': getSetupToken(),
				},
				body: JSON.stringify({
					fxserverPath: formData.fxserverPath,
					dataPath: formData.resourcePath,
				}),
			});

			const payload = (await res.json().catch(() => null)) as
				| { success: true; data: DetectData }
				| { success: false; error: string }
				| null;

			if (!res.ok || !payload?.success) {
				throw new Error(
					(payload && !payload.success && payload.error) ||
						'File check failed.',
				);
			}

			onChange('fxserverPath', payload.data.executable);
			onChange('resourcePath', payload.data.dataPath);

			return payload.data.found;
		} catch (err) {
			setDetectError((err as Error).message);
			return null;
		} finally {
			setIsChecking(false);
		}
	}

	async function handleNext() {
		if (formData.serverSetupMethod === 'installer') {
			if (detectedOk) onNext();
			return;
		}

		if (!formData.fxserverPath || !formData.resourcePath) {
			setDetectError('Please fill in both paths before continuing.');
			return;
		}

		const foundStatus = await runCheck();

		if (!foundStatus) return;

		const allFilesExist =
			foundStatus.executable && foundStatus.dataPath && foundStatus.cfg;

		if (!allFilesExist) {
			setMissingFiles(foundStatus);
		} else {
			onNext();
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
		<>
			<div className="flex flex-col gap-6 py-4 w-full relative">
				<div className="space-y-1">
					<h3 className="text-base font-semibold">
						Instance Core Path Definitions
					</h3>
					<p className="text-xs text-muted-foreground">
						Point fxManager at your FXServer binary and data folder - or let it
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
								placeholder="/home/fxserver/server-data"
								value={formData.resourcePath}
								onChange={(e) => onChange('resourcePath', e.target.value)}
								required
							/>
						</div>

						{detectError && (
							<p className="text-sm text-destructive">{detectError}</p>
						)}
					</div>
				) : (
					<div className="flex flex-col gap-4">
						{detecting && (
							<div className="flex items-center gap-2 text-sm text-muted-foreground">
								<Spinner className="size-4" /> Scanning for an existing
								install...
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
							disabled={detecting || isChecking}
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
						onClick={handleNext}
						disabled={
							(formData.serverSetupMethod === 'installer' && !detectedOk) ||
							detecting ||
							isChecking
						}
					>
						{isChecking ? (
							<>
								<Spinner className="size-4" /> Checking Files...
							</>
						) : (
							<>
								Continue <ArrowRight className="size-4" />
							</>
						)}
					</Button>
				</div>
			</div>

			<Dialog
				open={!!missingFiles}
				onOpenChange={(isOpen) => !isOpen && setMissingFiles(null)}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<AlertTriangle className="size-5 text-amber-500" />
							Missing Files Detected
						</DialogTitle>
						<DialogDescription>
							We couldn't verify the following required components at the paths
							you provided:
						</DialogDescription>
					</DialogHeader>

					{missingFiles && (
						<div className="flex flex-col gap-3 py-2">
							{!missingFiles.executable && (
								<div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
									<XCircle className="size-4 mt-0.5 shrink-0" />
									<p>
										<strong>FXServer Executable</strong> was not found. Please
										ensure the path points directly to your FXServer binary or
										folder.
									</p>
								</div>
							)}
							{!missingFiles.dataPath && (
								<div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
									<XCircle className="size-4 mt-0.5 shrink-0" />
									<p>
										<strong>Data Folder</strong> could not be read or does not
										exist.
									</p>
								</div>
							)}
							{!missingFiles.cfg && missingFiles.dataPath && (
								<div className="flex items-start gap-2 text-sm text-amber-600 bg-amber-500/10 p-3 rounded-md dark:text-amber-500">
									<InfoIcon className="size-4 mt-0.5 shrink-0" />
									<p>
										<strong>server.cfg</strong> was not found in the provided
										server data path.
									</p>
								</div>
							)}
							{!missingFiles.cfg && !missingFiles.dataPath && (
								<div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
									<XCircle className="size-4 mt-0.5 shrink-0" />
									<p>
										<strong>server.cfg</strong> could not be located because the
										data folder is invalid.
									</p>
								</div>
							)}
						</div>
					)}

					<DialogFooter className="mt-4 flex sm:justify-end gap-2">
						<Button variant="outline" onClick={() => setMissingFiles(null)}>
							Review Paths
						</Button>
						<Button
							onClick={() => {
								setMissingFiles(null);
								onNext();
							}}
						>
							Proceed Anyway
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
