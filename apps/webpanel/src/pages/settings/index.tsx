import { Settings } from 'lucide-react';
import { PageHeader } from '@/components/page-header';
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from '@fxmanager/ui/components/tabs';
import { ScrollArea } from '@fxmanager/ui/components/scroll-area';
import { mockSettings } from './mock-settings';
import {
	BansTab,
	DiscordTab,
	FxserverTab,
	GameTab,
	GeneralTab,
	WhitelistTab,
} from './components/config-tabs';

export default function SettingsPage() {
	return (
		<div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
			<PageHeader
				Icon={Settings}
				title="Settings"
				description="Configuration options for fxManager."
			/>

			<Tabs defaultValue="general" className="flex-1 overflow-hidden">
				<TabsList className="w-full justify-start flex-wrap h-auto">
					<TabsTrigger value="general">General</TabsTrigger>
					<TabsTrigger value="fxserver">FXServer</TabsTrigger>
					<TabsTrigger value="bans">Bans</TabsTrigger>
					<TabsTrigger value="whitelist">Whitelist</TabsTrigger>
					<TabsTrigger value="discord">Discord</TabsTrigger>
					<TabsTrigger value="game">Game</TabsTrigger>
				</TabsList>

				<ScrollArea className="h-[calc(100vh-12rem)]">
					<div className="pr-4">
						<TabsContent value="general">
							<GeneralTab data={mockSettings.general} />
						</TabsContent>
						<TabsContent value="fxserver">
							<FxserverTab data={mockSettings.fxserver} />
						</TabsContent>
						<TabsContent value="bans">
							<BansTab data={mockSettings.bans} />
						</TabsContent>
						<TabsContent value="whitelist">
							<WhitelistTab data={mockSettings.whitelist} />
						</TabsContent>
						<TabsContent value="discord">
							<DiscordTab data={mockSettings.discord} />
						</TabsContent>
						<TabsContent value="game">
							<GameTab data={mockSettings.game} />
						</TabsContent>
					</div>
				</ScrollArea>
			</Tabs>
		</div>
	);
}
