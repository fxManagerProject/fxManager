import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');
const REMOTE = 'origin';
const MAIN_BRANCH = 'main';

const versionArg = process.argv[2];

if (!versionArg) {
	console.error(
		'Please provide the complete version to release (e.g., bun ./scripts/release.ts v0.3.3)',
	);
	process.exit(1);
}

const normalizedVersion = versionArg.toLowerCase().startsWith('v')
	? versionArg.slice(1)
	: versionArg;
const tag = `v${normalizedVersion}`;

console.log(`🎯 Preparing release ${tag} on ${MAIN_BRANCH}...`);

function fail(message: string, hint?: string): never {
	console.error(`\n❌ ${message}`);
	if (hint) {
		console.error(`\n${hint}`);
	}
	process.exit(1);
}

function step(description: string, command: string, args: string[]): void {
	console.log(`▶ ${description}`);
	const result = spawnSync(command, args, {
		cwd: ROOT_DIR,
		encoding: 'utf8',
		stdio: 'inherit',
	});
	if (result.status !== 0) {
		fail(`${description} failed (exit code ${result.status}).`);
	}
	console.log(`✅ ${description}`);
	console.log();
}

function capture(command: string, args: string[]): string {
	const result = spawnSync(command, args, {
		cwd: ROOT_DIR,
		encoding: 'utf8',
	});
	if (result.status !== 0) {
		fail(
			`"${command} ${args.join(' ')}" failed (exit code ${result.status}).`,
			result.stderr.trim() || result.error?.message,
		);
	}
	return result.stdout.trim();
}

function gitExists(args: string[]): boolean {
	const result = spawnSync('git', args, {
		cwd: ROOT_DIR,
		encoding: 'utf8',
	});
	return result.status === 0;
}

const statusLines = capture('git', ['status', '--porcelain']).split('\n');
const trackedChanges = statusLines.filter(
	(line) => line.length > 0 && !line.startsWith('??'),
);
if (trackedChanges.length > 0) {
	fail(
		'The working tree has uncommitted changes; commit or stash them first.',
		trackedChanges.join('\n'),
	);
}

const untrackedCount = statusLines.filter((line) =>
	line.startsWith('??'),
).length;
if (untrackedCount > 0) {
	console.log(
		`⚠ ${untrackedCount} untracked file(s) present — they will be left untouched.`,
	);
	console.log();
}

const currentBranch = capture('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (currentBranch !== MAIN_BRANCH) {
	step('Switching to main', 'git', ['checkout', MAIN_BRANCH]);
} else {
	console.log('Already on main.');
	console.log();
}

step('Pulling the latest main', 'git', ['pull', '--ff-only']);

step('Bumping the version', process.execPath, [
	'./scripts/bump-version.ts',
	normalizedVersion,
]);

step('Staging the version bump', 'git', ['add', '-u']);

const stagedFiles = capture('git', ['diff', '--cached', '--name-only'])
	.split('\n')
	.filter((path) => path.length > 0);

if (stagedFiles.length === 0) {
	fail(
		`Nothing to commit — is ${tag} already the current version in package.json?`,
	);
}

const nonPackageFiles = stagedFiles.filter(
	(path) => !path.endsWith('package.json'),
);
if (nonPackageFiles.length > 0) {
	fail(
		'Refusing to commit files other than package.json changes.',
		nonPackageFiles.join('\n'),
	);
}

step('Committing the version bump', 'git', [
	'commit',
	'-m',
	`chore: release ${tag}`,
]);

step('Running biome format', 'bun', ['run', 'format']);
step('Staging biome format changes', 'git', ['add', '-u']);

const formattedFiles = capture('git', ['diff', '--cached', '--name-only'])
	.split('\n')
	.filter((path) => path.length > 0);

if (formattedFiles.length > 0) {
	console.log(
		`📝 Biome formatted ${formattedFiles.length} file(s). Committing...`,
	);
	step('Committing the format', 'git', [
		'commit',
		'-m',
		'chore: biome cleanup',
	]);
} else {
	console.log('✨ Biome found no formatting changes to commit.');
	console.log();
}

const remoteTags = capture('git', [
	'ls-remote',
	'--tags',
	REMOTE,
	`refs/tags/${tag}`,
]);

if (
	gitExists(['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]) ||
	remoteTags.length > 0
) {
	fail(
		`Tag ${tag} already exists. Pick a new version, or delete the tag first if you intend to re-release.`,
		`git tag -d ${tag} && git push ${REMOTE} :${tag}`,
	);
}

step('Creating the release tag', 'git', ['tag', tag]);
step('Pushing main', 'git', ['push', REMOTE, MAIN_BRANCH]);
step('Pushing the release tag', 'git', ['push', REMOTE, tag]);

console.log(
	`🎉 Release ${tag} is out:\n` +
		`   • version bump committed on ${MAIN_BRANCH} ("chore: release ${tag}")\n` +
		`   • tag ${tag} pushed to ${REMOTE}\n`,
);
