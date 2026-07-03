const FXSERVER_BUILD_REGEX = /v1\.0\.0\.(\d{4,8})/;

export function parseFxServerBuild(version: string): string | null {
	const match = FXSERVER_BUILD_REGEX.exec(version);
	return match?.[1] ?? null;
}
