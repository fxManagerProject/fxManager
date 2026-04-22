import { useState, useCallback } from 'react';
import type { ActionTab } from '@/components/player-actions-dialog';
import type { Player } from '@fxmanager/shared/types';

type ActionDialogPlayer = Pick<Player, 'id' | 'name' | 'isStaff'>;

interface UsePlayerActionReturn {
	dialogOpen: boolean;
	dialogPlayer: ActionDialogPlayer | null;
	dialogTab: ActionTab;
	openAction: (player: ActionDialogPlayer, tab?: ActionTab) => void;
	closeAction: () => void;
}

export function usePlayerAction(): UsePlayerActionReturn {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogPlayer, setDialogPlayer] = useState<ActionDialogPlayer | null>(
		null,
	);
	const [dialogTab, setDialogTab] = useState<ActionTab>('warn');

	const openAction = useCallback(
		(player: ActionDialogPlayer, tab: ActionTab = 'warn') => {
			setDialogPlayer(player);
			setDialogTab(tab);
			setDialogOpen(true);
		},
		[],
	);

	const closeAction = useCallback(() => {
		setDialogOpen(false);
	}, []);

	return { dialogOpen, dialogPlayer, dialogTab, openAction, closeAction };
}
