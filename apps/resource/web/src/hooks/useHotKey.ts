import { useEffect } from 'react';

interface ModifierKeys {
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
}

export function useHotkey(
	targetKey: string,
	callback: () => void,
	modifiers: ModifierKeys = {},
) {
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Don't trigger if user is typing in an input or textarea
			const target = event.target as HTMLElement;
			if (
				!['escape', 'f6', 'f7'].includes(targetKey.toLowerCase()) &&
				(target.tagName === 'INPUT' ||
					target.tagName === 'TEXTAREA' ||
					target.tagName === 'SELECT' ||
					target.isContentEditable)
			) {
				return;
			}

			const matchesKey = event.key.toLowerCase() === targetKey.toLowerCase();
			const matchesCtrl = modifiers.ctrl
				? event.ctrlKey || event.metaKey
				: true;
			const matchesAlt = modifiers.alt ? event.altKey : true;
			const matchesShift = modifiers.shift ? event.shiftKey : true;

			if (matchesKey && matchesCtrl && matchesAlt && matchesShift) {
				event.preventDefault();
				callback();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [targetKey, callback, modifiers]);
}
