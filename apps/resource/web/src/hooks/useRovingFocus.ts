import { useCallback, useRef, useState, type KeyboardEvent } from 'react';

interface UseRovingFocusOptions {
	itemCount: number;
	orientation?: 'vertical' | 'horizontal';
	onActivate?: (index: number) => void;
}

// Implements the roving-tabindex pattern: only the active item is tab-stoppable,
// arrow keys move focus between items, Enter/Space activates the focused one.
export function useRovingFocus({
	itemCount,
	orientation = 'vertical',
	onActivate,
}: UseRovingFocusOptions) {
	const [activeIndex, setActiveIndex] = useState(0);
	const itemRefs = useRef<(HTMLElement | null)[]>([]);

	const focusItem = useCallback(
		(index: number) => {
			if (itemCount === 0) return;
			const next = (index + itemCount) % itemCount;
			setActiveIndex(next);
			itemRefs.current[next]?.focus();
		},
		[itemCount],
	);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent, index: number) => {
			const nextKey = orientation === 'vertical' ? 'ArrowDown' : 'ArrowRight';
			const prevKey = orientation === 'vertical' ? 'ArrowUp' : 'ArrowLeft';

			switch (e.key) {
				case nextKey:
					e.preventDefault();
					focusItem(index + 1);
					break;
				case prevKey:
					e.preventDefault();
					focusItem(index - 1);
					break;
				case 'Home':
					e.preventDefault();
					focusItem(0);
					break;
				case 'End':
					e.preventDefault();
					focusItem(itemCount - 1);
					break;
				case 'Enter':
				case ' ':
					e.preventDefault();
					onActivate?.(index);
					break;
			}
		},
		[orientation, focusItem, itemCount, onActivate],
	);

	const getItemProps = (index: number) => ({
		ref: (el: HTMLElement | null) => {
			itemRefs.current[index] = el;
		},
		tabIndex: index === activeIndex ? 0 : -1,
		onKeyDown: (e: KeyboardEvent) => handleKeyDown(e, index),
		onFocus: () => setActiveIndex(index),
	});

	return { activeIndex, getItemProps, focusItem };
}
