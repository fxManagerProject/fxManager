function compareVersions(current: string, latest: string): number {
  const parse = (v: string) => {
    const [main, beta] = v.replace('v', '').split('-');
    return {
      parts: main.split('.').map(Number),
      isBeta: beta === 'b',
    };
  };

  const c = parse(current);
  const l = parse(latest);

  for (let i = 0; i < 3; i++) {
    if (c.parts[i] < l.parts[i]) return 1;
    if (c.parts[i] > l.parts[i]) return -1;
  }

  if (c.isBeta && !l.isBeta) return 1;
  if (!c.isBeta && l.isBeta) return -1;

  return 0;
}

export async function checkVersion(currentVersion: string) {
  if (currentVersion === 'dev-build') {
    console.info(`[core - version] Running in development mode.`);
    return;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/Maximus7474/fxManager/releases/latest`,
      {
        headers: { 'User-Agent': 'fxManager-Updater' },
      },
    );

    if (!response.ok) throw new Error(`${response.status} - ${response.statusText}`);

    const data = await response.json();
    const latestVersion = data.tag_name;
    const releaseUrl = data.html_url;

    const comparison = compareVersions(currentVersion, latestVersion);
    const isCurrentBeta = currentVersion.includes('-b');

    if (isCurrentBeta) {
      console.info(`[core - version] Currently running a Beta release: ${currentVersion}`);
      console.info(`[core - version] Latest stable release is: ${latestVersion}`);
      console.info(
        `[core - version] Beta builds are experimental and may contain breaking changes.`,
      );
      console.info(`[core - version] Check for stable updates at: ${releaseUrl}\n`);
      return;
    }

    if (comparison === 1) {
      console.info(
        `[core - version] You are running an outdated version (v${currentVersion}), a newer stable version is available: ${latestVersion}`,
      );
      console.info(`[core - version] It is highly recommended to update to maintain stability.`);
      console.info(`[core - version] Download: ${releaseUrl}\n`);
    } else if (comparison === 0) {
      console.info(`[core - version] fxManager is up to date (${currentVersion})`);
    } else {
      console.info(
        `[core - version] You are running a development or custom version (${currentVersion})`,
      );
    }
  } catch (err) {
    console.error(`[core - version] Could not check for updates:`, (err as Error).message);
  }
}
