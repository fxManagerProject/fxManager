// credit npwd
// licensed under Creative Commons Attribution-NonCommercial-ShareAlike 4.0
// https://github.com/project-error/npwd/blame/d8dc5b7f47faf5fc581ffee30f31ff61d184cfe7/phone/src/os/phone/hooks/useClipboard.ts

export const setClipboard = (value: string) => {
	const clipElem = document.createElement('input');
	clipElem.value = value;
	document.body.appendChild(clipElem);
	clipElem.focus();
	clipElem.select();

	const output = document.execCommand('copy');
	if (!output) {
		console.error(
			`^1Failed to copy value:^7 "${value}"\nTry interacting further with the UI (opening fields you can type in) to try resolving it.`,
		);
		return false;
	}

	document.body.removeChild(clipElem);
	return true;
};
