const BUILD_NUMBER_REGEX = /^\d{4,8}$/;

export type ArtifactStatus = 'unknown' | 'outdated' | 'current' | 'ahead';

/**
 * Compare the running FXServer build against the recommended one.
 *
 * Both sides are bare build numbers (e.g. '13068') — the running one comes off
 * the server_state socket, the recommended one from /server/artifact/recommended.
 * Anything missing or not shaped like a build yields 'unknown' so the UI stays
 * quiet instead of claiming an artifact is outdated on bad data.
 */
export function compareArtifactBuilds(
	current: string | null | undefined,
	recommended: string | null | undefined,
): ArtifactStatus {
	if (!current || !recommended) return 'unknown';
	if (
		!BUILD_NUMBER_REGEX.test(current) ||
		!BUILD_NUMBER_REGEX.test(recommended)
	)
		return 'unknown';

	const currentBuild = Number(current);
	const recommendedBuild = Number(recommended);

	if (currentBuild === recommendedBuild) return 'current';

	return currentBuild < recommendedBuild ? 'outdated' : 'ahead';
}
