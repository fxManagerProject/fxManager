import { useState, useCallback, useEffect } from 'react';
import { isEnvBrowser } from '~/utils/misc';

interface UseRovingFocusOptions {
	itemCount: number;
	disabled?: boolean;
	onActivate?: (index: number) => void;
	onNextCategory?: () => void;
	onPrevCategory?: () => void;
}

export function useRovingFocus({
	itemCount,
	disabled = false,
	onActivate,
	onNextCategory,
	onPrevCategory,
}: UseRovingFocusOptions) {
	// index -1 = Category Header Bar, 0 to itemCount - 1 = Action items
	const [activeIndex, setActiveIndex] = useState(0);

	const moveDown = useCallback(() => {
		setActiveIndex((prev) => {
			if (prev < itemCount - 1) return prev + 1;
			return 0;
		});
	}, [itemCount]);

	const moveUp = useCallback(() => {
		setActiveIndex((prev) => {
			if (prev >= 0) return prev - 1;
			return itemCount - 1;
		});
	}, []);

	const moveLeft = useCallback(() => {
		setActiveIndex((prev) => {
			if (prev === -1) {
				onPrevCategory?.();
			}
			return prev;
		});
	}, [onPrevCategory]);

	const moveRight = useCallback(() => {
		setActiveIndex((prev) => {
			if (prev === -1) {
				onNextCategory?.();
			}
			return prev;
		});
	}, [onNextCategory]);

	const activateCurrent = useCallback(() => {
		setActiveIndex((prev) => {
			if (prev >= 0) {
				onActivate?.(prev);
			} else if (prev === -1) {
				// Pressing Enter/Select on header drops focus to item 0
				return 0;
			}
			return prev;
		});
	}, [onActivate]);

	// Dev-only fallback keyboard listener when testing in standard web browser
	useEffect(() => {
		if (!isEnvBrowser()) return;

		const handleKeyDown = (e: KeyboardEvent) => {
			if (disabled) return;

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					moveDown();
					break;
				case 'ArrowUp':
					e.preventDefault();
					moveUp();
					break;
				case 'ArrowLeft':
					e.preventDefault();
					moveLeft();
					break;
				case 'ArrowRight':
					e.preventDefault();
					moveRight();
					break;
				case 'Enter':
				case ' ':
					e.preventDefault();
					activateCurrent();
					break;
				case 'Tab':
					e.preventDefault();
					setActiveIndex(-1);
					break;
				default:
					console.log('[DEV] Unknown key', e.key);
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [moveDown, moveUp, moveLeft, moveRight, activateCurrent]);

	return {
		activeIndex,
		moveDown,
		moveUp,
		moveLeft,
		moveRight,
		activateCurrent,
		resetFocus: () => setActiveIndex(-1),
	};
}
