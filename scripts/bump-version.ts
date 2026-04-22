import { readFileSync, writeFileSync } from 'node:fs';

let newVersion = process.argv[2];

if (!newVersion) {
	console.error(
		'Please provide a version (e.g., bun run sync-versions.ts 1.0.0-b)',
	);
	process.exit(1);
}

if (newVersion.toLowerCase().startsWith('v')) {
  newVersion = newVersion.substring(1);
}

const semverRegex = /^(\d+)\.(\d+)\.(\d+)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?(\+[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$/;

if (!semverRegex.test(newVersion)) {
  console.error(`❌ Error: "${newVersion}" is not a valid Semantic Version.`);
  console.log("Example of valid versions: 1.0.0, 1.0.2-b, 2.1.0-beta.5");
  process.exit(1);
}

const glob = new Bun.Glob("**/package.json");
const packagePaths = Array.from(glob.scanSync({
  onlyFiles: true,
}));
console.log(
	`Updating ${packagePaths.length} files to version ${newVersion}...`,
);

for (const path of packagePaths) {
	try {
		const content = JSON.parse(readFileSync(path, 'utf-8'));

		if (content.version) {
			content.version = newVersion;

			writeFileSync(path, JSON.stringify(content, null, 2) + '\n');
			console.log(`✅ Updated: ${path}`);
		}
	} catch (err) {
		console.error(`❌ Failed to update ${path}:`, err);
	}
}
