import { PageHeader } from '@/components/page-header';
import { QueryService } from '@/lib/query';
import type {
	AdminGroup,
	ApiResponse,
	CreateAdminForm,
} from '@fxmanager/shared/types';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import PermissionEditor from './components/permissioneditor';
import { Button } from '@fxmanager/ui/components/button';
import { Card, CardContent } from '@fxmanager/ui/components/card';
import { Label } from '@fxmanager/ui/components/label';
import { Input } from '@fxmanager/ui/components/input';
import { PlayerSearch } from './components/player-search';

export default function AdminCreate() {
	const navigate = useNavigate();
	const [saving, setSaving] = useState<boolean>(false);
	const [group, setGroup] = useState<AdminGroup | null>(null);
	const [formData, setFormData] = useState<CreateAdminForm>({
		username: '',
		permissions: 0,
		groupId: null,
		playerId: null,
	});

	async function handleSubmit() {
		setSaving(true);

		const createPromise = QueryService<ApiResponse<{ password?: string }>>({
			endpoint: '/settings/admins/create',
			method: 'POST',
			body: formData,
		});

		toast.promise(createPromise, {
			loading: 'Generating admin account...',
			success: (r) => {
				if (!r.success) throw new Error(r.error);

				if (r.data.password) {
					navigator.clipboard.writeText(r.data.password);
				}

				setTimeout(() => navigate('/settings/admins', { replace: true }), 2000);

				return (
					<div className="flex flex-col gap-1">
						<span className="font-bold">Admin Created!</span>
						<span className="text-xs opacity-90">
							Password copied to clipboard. Redirecting...
						</span>
					</div>
				);
			},
			error: (err) => {
				return `Failed to create admin: ${err.message}`;
			},
			finally: () => setSaving(false),
		});
	}

	return (
		<div className="flex h-[calc(100vh-5rem)] flex-col gap-4 overflow-hidden">
			<PageHeader
				Icon={UserPlus}
				title="Create Admin"
				description="Add a new admin user to the panel."
			/>

			<Card className="flex flex-col flex-1 min-h-0 overflow-hidden">
				<CardContent className="flex flex-col h-full px-6 gap-6 overflow-hidden">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
						<div className="space-y-2">
							<Label className="text-sm font-medium">Username</Label>
							<Input
								placeholder="e.g. Moderator_John"
								value={formData.username}
								onChange={(e) =>
									setFormData({ ...formData, username: e.target.value })
								}
							/>
						</div>

						<div className="space-y-2 flex flex-col">
							<Label className="text-sm font-medium">Player (Optional)</Label>
							<PlayerSearch
								value={formData.playerId}
								onChange={(playerId) => setFormData({ ...formData, playerId })}
							/>
						</div>
					</div>
					<div className="flex flex-col flex-1 min-h-0 overflow-hidden space-y-2">
						<Label className="text-sm font-medium">Permission Editor</Label>
						<PermissionEditor
							skipServerSave={true}
							value={formData.permissions}
							group={group}
							updatePerms={(newPerms) =>
								setFormData({ ...formData, permissions: newPerms })
							}
							updateGroup={(newGroup) => {
								setGroup(newGroup);
								setFormData({
									...formData,
									groupId: newGroup?.id ?? null,
									permissions: newGroup ? 0 : formData.permissions,
								});
							}}
						/>
					</div>

					<Button
						onClick={handleSubmit}
						disabled={saving}
						className="w-full bg-green-600 hover:bg-green-700 shrink-0 mt-auto"
					>
						Finalize & Create Admin
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
