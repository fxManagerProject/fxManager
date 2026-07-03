export function getSetupToken(): string {
	return new URLSearchParams(window.location.search).get('token') ?? '';
}
