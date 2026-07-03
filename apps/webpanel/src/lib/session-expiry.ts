type UnauthorizedHandler = () => void;

let handler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(next: UnauthorizedHandler | null): void {
	handler = next;
}

export function notifyUnauthorized(): void {
	handler?.();
}
