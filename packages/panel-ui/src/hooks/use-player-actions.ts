import { useState, useCallback } from 'react';
import type { Player } from '@fxmanager/types';
import type { ActionTab } from '@/components/player-actions';

type ActionDialogPlayer = Pick<Player, 'id' | 'name' | 'isStaff'>;

interface UsePlayerActionReturn {
  dialogOpen: boolean;
  dialogPlayer: ActionDialogPlayer | null;
  dialogTab: ActionTab;
  openAction: (player: ActionDialogPlayer, tab?: ActionTab) => void;
  closeAction: () => void;
}

export function usePlayerAction(): UsePlayerActionReturn {
  const [dialogOpen, setSheetOpen] = useState(false);
  const [dialogPlayer, setSheetPlayer] = useState<ActionDialogPlayer | null>(null);
  const [dialogTab, setSheetTab] = useState<ActionTab>('warn');

  const openAction = useCallback((player: ActionDialogPlayer, tab: ActionTab = 'warn') => {
    setSheetPlayer(player);
    setSheetTab(tab);
    setSheetOpen(true);
  }, []);

  const closeAction = useCallback(() => {
    setSheetOpen(false);
  }, []);

  return { dialogOpen, dialogPlayer, dialogTab, openAction, closeAction };
}
