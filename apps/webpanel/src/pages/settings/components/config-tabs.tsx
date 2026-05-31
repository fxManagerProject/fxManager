import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@fxmanager/ui/components/card';
import { Input } from '@fxmanager/ui/components/input';
import { Label } from '@fxmanager/ui/components/label';
import { Switch } from '@fxmanager/ui/components/switch';
import { Textarea } from '@fxmanager/ui/components/textarea';
import { Button } from '@fxmanager/ui/components/button';
import { Badge } from '@fxmanager/ui/components/badge';
import { Separator } from '@fxmanager/ui/components/separator';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@fxmanager/ui/components/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@fxmanager/ui/components/table';
import type { ServerSettings } from '../mock-settings';

function SettingRow({
	label,
	description,
	children,
}: {
	label: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<div className="space-y-0.5">
				<Label>{label}</Label>
				{description && (
					<p className="text-sm text-muted-foreground">{description}</p>
				)}
			</div>
			<div className="sm:max-w-sm sm:w-full">{children}</div>
		</div>
	);
}

function SettingsCard({
	title,
	description,
	children,
}: {
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
				<CardDescription>{description}</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">{children}</CardContent>
		</Card>
	);
}

export function GeneralTab({ data }: { data: ServerSettings['general'] }) {
	return (
		<SettingsCard
			title="General"
			description="Basic information about your server."
		>
			<SettingRow label="Server Name">
				<Input defaultValue={data.serverName} />
			</SettingRow>
			<Separator />
			<SettingRow label="Language">
				<Select defaultValue={data.language}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="en">English</SelectItem>
						<SelectItem value="fr">French</SelectItem>
						<SelectItem value="de">German</SelectItem>
						<SelectItem value="es">Spanish</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>
			<Separator />
			<SettingRow label="Theme">
				<Select defaultValue={data.theme}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="dark">Dark</SelectItem>
						<SelectItem value="light">Light</SelectItem>
						<SelectItem value="system">System</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>
			<Separator />
			<SettingRow
				label="Quiet Mode"
				description="Hide non-critical notifications in the panel."
			>
				<Switch defaultChecked={data.quietMode} />
			</SettingRow>
		</SettingsCard>
	);
}

export function FxserverTab({ data }: { data: ServerSettings['fxserver'] }) {
	return (
		<SettingsCard
			title="FXServer"
			description="Paths and runtime behaviour of the FXServer instance."
		>
			<SettingRow label="Server Data Path">
				<Input defaultValue={data.dataPath} />
			</SettingRow>
			<Separator />
			<SettingRow label="CFG File Path">
				<Input defaultValue={data.cfgPath} />
			</SettingRow>
			<Separator />
			<SettingRow label="OneSync">
				<Select defaultValue={data.onesync}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="on">On</SelectItem>
						<SelectItem value="legacy">Legacy</SelectItem>
						<SelectItem value="off">Off</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>
			<Separator />
			<SettingRow
				label="Autostart"
				description="Start the server automatically when fxManager boots."
			>
				<Switch defaultChecked={data.autostart} />
			</SettingRow>
			<Separator />
			<SettingRow
				label="Restart on Crash"
				description="Automatically restart the server if it crashes."
			>
				<Switch defaultChecked={data.restartOnCrash} />
			</SettingRow>
		</SettingsCard>
	);
}

export function BansTab({ data }: { data: ServerSettings['bans'] }) {
	const fileInputRef = useRef<HTMLInputElement>(null);

	const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		toast.success(`Imported ban templates from "${file.name}"`);
		event.target.value = '';
	};

	return (
		<SettingsCard
			title="Bans"
			description="Configure banning behaviour and reusable templates."
		>
			<div className="flex items-center justify-end">
				<input
					ref={fileInputRef}
					type="file"
					accept="application/json"
					className="hidden"
					onChange={handleImport}
				/>
				<Button
					variant="outline"
					size="sm"
					onClick={() => fileInputRef.current?.click()}
				>
					<Upload className="h-4 w-4" />
					Import txAdmin JSON
				</Button>
			</div>

			<SettingRow
				label="Enable Bans"
				description="Allow admins to ban players from the server."
			>
				<Switch defaultChecked={data.enabled} />
			</SettingRow>
			<Separator />
			<SettingRow
				label="Require Reason"
				description="Force admins to provide a reason when banning."
			>
				<Switch defaultChecked={data.requireReason} />
			</SettingRow>
			<Separator />

			<div className="space-y-3">
				<Label>Ban Templates</Label>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Reason</TableHead>
							<TableHead className="w-32">Duration</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data.templates.map((template) => (
							<TableRow key={template.id}>
								<TableCell>{template.reason}</TableCell>
								<TableCell>
									<Badge variant="outline">{template.duration}</Badge>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</SettingsCard>
	);
}

export function WhitelistTab({ data }: { data: ServerSettings['whitelist'] }) {
	return (
		<SettingsCard
			title="Whitelist"
			description="Control who is allowed to join the server."
		>
			<SettingRow label="Whitelist Mode">
				<Select defaultValue={data.mode}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="disabled">Disabled</SelectItem>
						<SelectItem value="admin-only">Admin only</SelectItem>
						<SelectItem value="approved-license">Approved license</SelectItem>
						<SelectItem value="discord-guild">Discord guild member</SelectItem>
						<SelectItem value="discord-roles">Discord roles</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>
			<Separator />
			<SettingRow label="Discord Guild ID">
				<Input defaultValue={data.discordGuildId} />
			</SettingRow>
			<Separator />
			<SettingRow label="Rejection Message">
				<Textarea defaultValue={data.rejectionMessage} />
			</SettingRow>
		</SettingsCard>
	);
}

export function DiscordTab({ data }: { data: ServerSettings['discord'] }) {
	return (
		<SettingsCard
			title="Discord"
			description="Connect a Discord bot for whitelist and status integration."
		>
			<SettingRow
				label="Enable Discord Bot"
				description="Enable the Discord integration."
			>
				<Switch defaultChecked={data.enabled} />
			</SettingRow>
			<Separator />
			<SettingRow label="Bot Token">
				<Input type="password" defaultValue={data.token} />
			</SettingRow>
			<Separator />
			<SettingRow label="Guild ID">
				<Input defaultValue={data.guildId} />
			</SettingRow>
			<Separator />
			<SettingRow label="Status Command">
				<Input defaultValue={data.statusCommand} />
			</SettingRow>
		</SettingsCard>
	);
}

export function GameTab({ data }: { data: ServerSettings['game'] }) {
	return (
		<SettingsCard
			title="Game"
			description="In-game menu and player behaviour options."
		>
			<SettingRow
				label="Enable In-Game Menu"
				description="Allow admins to use the in-game menu."
			>
				<Switch defaultChecked={data.menuEnabled} />
			</SettingRow>
			<Separator />
			<SettingRow label="Menu Alignment">
				<Select defaultValue={data.menuAlignment}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="left">Left</SelectItem>
						<SelectItem value="right">Right</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>
			<Separator />
			<SettingRow label="Player Mode Permission">
				<Select defaultValue={data.playerModePermission}>
					<SelectTrigger className="w-full">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="disabled">Disabled</SelectItem>
						<SelectItem value="admin">Admins</SelectItem>
						<SelectItem value="all">Everyone</SelectItem>
					</SelectContent>
				</Select>
			</SettingRow>
			<Separator />
			<SettingRow
				label="Hide Admin in Punishments"
				description="Hide the admin name shown to punished players."
			>
				<Switch defaultChecked={data.hideAdminInPunishments} />
			</SettingRow>
		</SettingsCard>
	);
}
