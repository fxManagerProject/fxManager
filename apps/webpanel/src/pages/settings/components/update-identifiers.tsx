import { useEffect, useState } from 'react';
import { ScanEye, Info } from 'lucide-react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@fxmanager/ui/components/dialog';
import { Input } from '@fxmanager/ui/components/input';
import { Label } from '@fxmanager/ui/components/label';
import { Button } from '@fxmanager/ui/components/button';

interface IdentifiersDialogProps {
	initialCfxId?: string | null;
	initialDiscordId?: string | null;
	onSubmit: (data: { cfxId: string; discordId: string }) => Promise<void>;
	trigger?: React.ReactNode;
}

export function IdentifiersDialog({
	initialCfxId,
	initialDiscordId,
	onSubmit,
	trigger,
}: IdentifiersDialogProps) {
	const [open, setOpen] = useState(false);
	const [cfxId, setCfxId] = useState(initialCfxId ?? '');
	const [discordId, setDiscordId] = useState(initialDiscordId ?? '');
	const [isSubmitting, setIsSubmitting] = useState(false);

	// Synchronize local form state with admin data when opened or updated
	useEffect(() => {
		if (open) {
			setCfxId(initialCfxId ?? '');
			setDiscordId(initialDiscordId ?? '');
		}
	}, [open, initialCfxId, initialDiscordId]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsSubmitting(true);
		try {
			await onSubmit({ cfxId, discordId });
			setOpen(false);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{trigger ?? (
					<Button variant="outline">
						<ScanEye className="h-4 w-4" />
						<span className="hidden lg:block">Update Identifiers</span>
					</Button>
				)}
			</DialogTrigger>

			<DialogContent className="sm:max-w-[425px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Update Player Identifiers</DialogTitle>
						<DialogDescription>
							Modify the linked Discord and Cfx identifiers for this account.
						</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						{/* Discord ID Field */}
						<div className="space-y-2">
							<div className="flex items-center gap-1.5">
								<Label htmlFor="discordId" className="text-sm font-medium">
									Discord ID
								</Label>
								<a
									href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID"
									target="_blank"
									rel="noopener noreferrer"
									title="How to find your Discord ID"
									className="text-muted-foreground hover:text-foreground transition-colors inline-flex items-center"
								>
									<Info className="h-3.5 w-3.5" />
								</a>
							</div>
							<Input
								id="discordId"
								value={discordId}
								onChange={(e) => setDiscordId(e.target.value)}
								placeholder="e.g. 123456789012345678"
							/>
						</div>

						{/* Cfx ID Field */}
						<div className="space-y-2">
							<Label htmlFor="cfxId" className="text-sm font-medium">
								Cfx ID
							</Label>
							<Input
								id="cfxId"
								value={cfxId}
								onChange={(e) => setCfxId(e.target.value)}
								placeholder="e.g. 123456"
							/>
						</div>
					</div>

					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							onClick={() => setOpen(false)}
						>
							Cancel
						</Button>
						<Button type="submit" disabled={isSubmitting}>
							{isSubmitting ? 'Saving...' : 'Save changes'}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
