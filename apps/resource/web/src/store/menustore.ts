import { create } from 'zustand';

interface MenuState {
	/**
	 * active item in the quickmenu
	 * [group, idx]
	 */
	item: [string, number];
	noclip: boolean;
	tags: boolean;
	blips: boolean;
	setItem: (group: string, idx: number) => void;
	setNoclip: (noclip: boolean) => void;
	setTags: (tags: boolean) => void;
	setBlips: (blips: boolean) => void;
}

export const useMenuStore = create<MenuState>((set) => ({
	item: ['Movement', 0],
	noclip: false,
	tags: false,
	blips: false,
	setItem: (group, item) => set({ item: [group, item] }),
	setNoclip: (noclip) => set({ noclip }),
	setTags: (tags) => set({ tags }),
	setBlips: (blips) => set({ blips }),
}));
