function compareVersions(current: string, latest: string): number {
  const parse = (v: string) => {
    const [main, beta] = v.replace('v', '').split('-');
    return {
      parts: main!.split('.').map(Number) as [number, number, number],
      isBeta: beta === 'b',
    };
  };

  const c = parse(current);
  const l = parse(latest);

for (let i = 0; i < 3; i++) {
  if (c.parts[i]! < l.parts[i]!) return 1; 
  if (c.parts[i]! > l.parts[i]!) return -1;
}

  if (c.isBeta && !l.isBeta) return 1;
  if (!c.isBeta && l.isBeta) return -1;

  return 0;
}

export async function checkVersion(currentVersion: string) {
  if (currentVersion === 'dev-build') {
    console.info(`[version] Running in development mode.`);
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

    const data = (await response.json()) as {
			tag_name: string;
			html_url: string;
			[key: string]: any;
		};
    const latestVersion = data.tag_name;
    const releaseUrl = data.html_url;

    const comparison = compareVersions(currentVersion, latestVersion);
    const isCurrentBeta = currentVersion.includes('-b');

    if (isCurrentBeta) {
      console.info(`[version] Currently running a Beta release: ${currentVersion}`);
      console.info(`[version] Latest stable release is: ${latestVersion}`);
      console.info(
        `[version] Beta builds are experimental and may contain breaking changes.`,
      );
      console.info(`[version] Check for stable updates at: ${releaseUrl}\n`);
      return;
    }

    if (comparison === 1) {
      console.info(
        `[version] You are running an outdated version (v${currentVersion}), a newer stable version is available: ${latestVersion}`,
      );
      console.info(`[version] It is highly recommended to update to maintain stability.`);
      console.info(`[version] Download: ${releaseUrl}\n`);
    } else if (comparison === 0) {
      console.info(`[version] fxManager is up to date (${currentVersion})`);
    } else {
      console.info(
        `[version] You are running a development or custom version (${currentVersion})`,
      );
    }
  } catch (err) {
    console.error(`[version] Could not check for updates:`, (err as Error).message);
  }
}
