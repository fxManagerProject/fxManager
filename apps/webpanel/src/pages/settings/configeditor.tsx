import { PageHeader } from '@/components/page-header';
import { useAuth } from '@/hooks/use-auth';
import { QueryService } from '@/lib/query';
import { UserPermissions } from '@fxmanager/shared/constants';
import type {
	ApiResponse,
	CfgFileContent,
	CfgFileNode,
	CfgGraph,
	CreateCfgResult,
	ManagedConvar,
	SaveCfgResult,
} from '@fxmanager/shared/types';
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from '@fxmanager/ui/components/alert';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@fxmanager/ui/components/alert-dialog';
import { Badge } from '@fxmanager/ui/components/badge';
import { Button } from '@fxmanager/ui/components/button';
import { Card } from '@fxmanager/ui/components/card';
import { Input } from '@fxmanager/ui/components/input';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import { Spinner } from '@fxmanager/ui/components/spinner';
import {
	FileCog,
	FileWarning,
	Info,
	Plus,
	RotateCw,
	Save,
	TriangleAlert,
} from 'lucide-react';
import {
	Suspense,
	lazy,
	useCallback,
	useEffect,
	useRef,
	useState,
} from 'react';
import { toast } from 'sonner';

const CfgCodeEditor = lazy(() =>
	import('./components/cfg-editor').then((m) => ({ default: m.CfgCodeEditor })),
);

const MANAGED_MESSAGES: Record<ManagedConvar['key'], string> = {
	onesync:
		'onesync is managed by fxManager (set it in Settings) — this line may be overridden at launch.',
	'resource-api-token':
		'resource-api-token is injected by fxManager and will be overridden at launch.',
	'api-port':
		'api-port is injected by fxManager and will be overridden at launch.',
	'fxmanager-resource':
		'The fxManager resource starts automatically — this line is unnecessary.',
};

interface OpenFile {
	path: string;
	baseline: string;
	exists: boolean;
	managed: ManagedConvar[];
}

export default function ConfigEditor() {
	const { hasPermission } = useAuth();
	const canRestart = hasPermission(UserPermissions.SERVER_ACTIONS);

	const [files, setFiles] = useState<CfgFileNode[]>([]);
	const [serverRunning, setServerRunning] = useState(false);
	const [open, setOpen] = useState<OpenFile | null>(null);
	const [draft, setDraft] = useState('');
	const [loadingFile, setLoadingFile] = useState(false);
	const [saving, setSaving] = useState(false);
	const [creating, setCreating] = useState(false);
	const [newName, setNewName] = useState('');
	const newNameRef = useRef<HTMLInputElement>(null);
	const [pendingRestart, setPendingRestart] = useState<
		'save-restart' | 'restart' | null
	>(null);

	const dirty = open ? draft !== open.baseline : false;
	const restartNeeded = serverRunning && files.some((f) => f.restartNeeded);

	const loadGraph = useCallback(async () => {
		const res = await QueryService<ApiResponse<CfgGraph>>({
			endpoint: '/config/graph',
			method: 'GET',
		});
		if (!res.success) {
			toast.error(`Failed to load config: ${res.error}`);
			return null;
		}
		setFiles(res.data.files);
		setServerRunning(res.data.serverRunning);
		return res.data;
	}, []);

	const openFile = useCallback(
		async (path: string) => {
			if (dirty && !window.confirm('Discard unsaved changes?')) return;
			setLoadingFile(true);
			try {
				const res = await QueryService<ApiResponse<CfgFileContent>>({
					endpoint: `/config/file?path=${encodeURIComponent(path)}`,
					method: 'GET',
				});
				if (!res.success) {
					toast.error(`Failed to open ${path}: ${res.error}`);
					return;
				}
				setOpen({
					path: res.data.path,
					baseline: res.data.content,
					exists: res.data.exists,
					managed: res.data.managed,
				});
				setDraft(res.data.content);
			} finally {
				setLoadingFile(false);
			}
		},
		[dirty],
	);

	const startCreating = () => {
		setNewName('');
		setCreating(true);
		setTimeout(() => newNameRef.current?.focus(), 0);
	};

	const submitCreate = async () => {
		const raw = newName.trim();
		if (!raw) return;

		const name = /\.cfg$/i.test(raw) ? raw : `${raw}.cfg`;

		const request = QueryService<ApiResponse<CreateCfgResult>>({
			endpoint: '/config/create',
			method: 'POST',
			body: { path: name },
		});

		setCreating(false);
		toast.promise(request, {
			loading: `Creating ${name}...`,
			success: (res) => {
				if (!res.success) throw new Error(res.error);
				(async () => {
					await loadGraph();
					await openFile(res.data.path);
				})();
				return `Created ${res.data.path}`;
			},
			error: (err) => `Failed to create file: ${(err as Error).message}`,
		});
	};

	useEffect(() => {
		(async () => {
			const data = await loadGraph();
			const first = data?.files[0];
			if (first) await openFile(first.path);
		})();
	}, []);

	useEffect(() => {
		if (!dirty) return;
		const handler = (e: BeforeUnloadEvent) => {
			e.preventDefault();
			e.returnValue = '';
		};
		window.addEventListener('beforeunload', handler);
		return () => window.removeEventListener('beforeunload', handler);
	}, [dirty]);

	const save = (restart: boolean) => {
		if (!open || saving) return;
		const path = open.path;
		const content = draft;
		setSaving(true);

		const request = QueryService<ApiResponse<SaveCfgResult>>({
			endpoint: '/config/file',
			method: 'POST',
			body: { path, content, restart },
		});

		toast.promise(request, {
			loading: restart ? 'Saving & restarting...' : 'Saving...',
			success: (res) => {
				if (!res.success) throw new Error(res.error);
				setOpen((prev) =>
					prev && prev.path === path
						? { ...prev, baseline: content, exists: true }
						: prev,
				);
				void loadGraph();
				return res.data.restarted
					? `Saved ${path} — server restarting`
					: `Saved ${path}`;
			},
			error: (err) => `Failed to save: ${(err as Error).message}`,
			finally: () => setSaving(false),
		});
	};

	const restartServer = async () => {
		const request = QueryService<{ success?: boolean }>({
			endpoint: '/server/restart',
			method: 'POST',
		});
		toast.promise(request, {
			loading: 'Restarting server...',
			success: () => {
				setTimeout(() => void loadGraph(), 1500);
				return 'Server restarting';
			},
			error: 'Failed to restart server',
		});
	};

	const confirmRestart = () => {
		const action = pendingRestart;
		setPendingRestart(null);
		if (action === 'save-restart') save(true);
		else if (action === 'restart') void restartServer();
	};

	return (
		<div className="flex h-[calc(100vh-5rem)] flex-col gap-4 overflow-hidden">
			<PageHeader
				Icon={FileCog}
				title="Config Editor"
				description="Edit server.cfg and the files it includes via exec."
			/>

			{restartNeeded && (
				<Alert>
					<TriangleAlert className="text-amber-500" />
					<AlertTitle>Config changed since the server loaded</AlertTitle>
					<AlertDescription>
						Restart the server to apply your changes.
					</AlertDescription>
					{canRestart && (
						<div className="absolute top-2.5 right-3">
							<Button
								size="sm"
								variant="outline"
								onClick={() => setPendingRestart('restart')}
							>
								<RotateCw className="size-4" /> Restart
							</Button>
						</div>
					)}
				</Alert>
			)}

			<Card className="flex flex-1 min-h-0 flex-row overflow-hidden p-0">
				{/* Editor pane */}
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex items-center gap-3 border-b px-4 py-2">
						{/* File switcher */}
						<div className="flex items-center gap-2 min-w-[200px]">
							<Select
								onValueChange={(value) => openFile(value)}
								value={open?.path || ''}
							>
								<SelectTrigger className="h-9 w-[18em]">
									<SelectValue placeholder="Select a file" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem
										value="server.cfg"
										className={`flex items-center gap-2 py-1.5 pr-3 text-left text-sm transition-colors hover:bg-accent ${
											open?.path === 'server.cfg' ? 'bg-accent font-medium' : ''
										}`}
									>
										server.cfg
									</SelectItem>

									<SelectGroup>
										<SelectLabel>Sub-files</SelectLabel>
										{files
											.filter((file) => file.path !== 'server.cfg')
											.map((file) => {
												const active = open?.path === file.path;
												return (
													<SelectItem
														key={file.path}
														value={file.path}
														className={`flex items-center gap-2 py-1.5 pr-3 text-left text-sm transition-colors hover:bg-accent ${
															active ? 'bg-accent font-medium' : ''
														}`}
													>
														<span className="truncate font-mono text-xs">
															{file.path}
														</span>
														{!file.exists && (
															<Badge
																variant="outline"
																className="ml-auto shrink-0"
															>
																new
															</Badge>
														)}
														{file.exists && file.restartNeeded && (
															<span
																className="ml-auto size-1.5 shrink-0 rounded-full bg-amber-500"
																title="Changed since the server loaded"
															/>
														)}
													</SelectItem>
												);
											})}
									</SelectGroup>

									<SelectSeparator />

									<div className="p-1 border-b">
										<button
											type="button"
											onClick={(e) => {
												e.stopPropagation();
												startCreating();
											}}
											className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
										>
											<Plus className="size-3.5" />
											Create New File
										</button>
									</div>
								</SelectContent>
							</Select>
						</div>

						{open && (
							<div className="flex items-center gap-2 min-w-0">
								{dirty && (
									<span
										className="size-2 shrink-0 rounded-full bg-primary"
										title="Unsaved changes"
									/>
								)}
								{!open.exists && (
									<Badge variant="outline" className="shrink-0">
										will be created
									</Badge>
								)}
							</div>
						)}

						{open && (
							<div className="ml-auto flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									disabled={!dirty || saving}
									onClick={() => save(false)}
								>
									<Save className="size-4" /> Save
								</Button>
								{canRestart && (
									<Button
										size="sm"
										disabled={saving}
										onClick={() => setPendingRestart('save-restart')}
									>
										<RotateCw className="size-4" /> Save &amp; Restart
									</Button>
								)}
							</div>
						)}
					</div>

					{creating && (
						<div className="border-b bg-muted/30 p-3">
							<div className="max-w-xs">
								<Input
									ref={newNameRef}
									value={newName}
									placeholder="name.cfg"
									className="h-8 font-mono text-xs"
									onChange={(e) => setNewName(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter') submitCreate();
										if (e.key === 'Escape') setCreating(false);
									}}
									onBlur={() => setCreating(false)}
								/>
								<p className="mt-1 text-[10px] text-muted-foreground">
									Created under server.cfg. Only .cfg files are supported.
								</p>
							</div>
						</div>
					)}

					{/* Editor Content  */}
					{open ? (
						<>
							{open.managed.length > 0 && (
								<div className="flex flex-col gap-1 border-b bg-muted/40 px-4 py-2">
									{open.managed.map((hit) => (
										<div
											key={`${hit.line}-${hit.key}`}
											className="flex items-start gap-2 text-xs text-muted-foreground"
										>
											<Info className="mt-0.5 size-3.5 shrink-0 text-sky-500" />
											<span>
												<span className="font-mono">Line {hit.line}:</span>{' '}
												{MANAGED_MESSAGES[hit.key]}
											</span>
										</div>
									))}
								</div>
							)}

							<div className="relative min-h-0 flex-1">
								{loadingFile && (
									<div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
										<Spinner />
									</div>
								)}
								<Suspense
									fallback={
										<div className="flex h-full items-center justify-center">
											<Spinner />
										</div>
									}
								>
									<CfgCodeEditor
										docKey={open.path}
										value={open.baseline}
										onChange={setDraft}
										onSave={() => save(false)}
									/>
								</Suspense>
							</div>
						</>
					) : (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
							{loadingFile ? (
								<Spinner />
							) : (
								<>
									<FileWarning className="size-8" />
									<span className="text-sm">
										Select a file from the menu above to edit
									</span>
								</>
							)}
						</div>
					)}
				</div>
			</Card>

			<AlertDialog
				open={pendingRestart !== null}
				onOpenChange={(o) => {
					if (!o) setPendingRestart(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Restart the server?</AlertDialogTitle>
						<AlertDialogDescription>
							{pendingRestart === 'save-restart'
								? 'This saves the file and restarts FXServer, disconnecting all connected players.'
								: 'This restarts FXServer, disconnecting all connected players.'}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmRestart}>
							{pendingRestart === 'save-restart' ? 'Save & Restart' : 'Restart'}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
