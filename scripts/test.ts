import { spawn } from 'node:child_process';
import { join } from 'node:path';

const ROOT_DIR = join(import.meta.dir, '..');

const testFiles: string[] = [];
for await (const file of new Bun.Glob('**/*.test.ts').scan({
	onlyFiles: true,
	cwd: ROOT_DIR,
})) {
	testFiles.push(file.replaceAll('\\', '/'));
}
testFiles.sort();

if (testFiles.length === 0) {
	console.log('No test files found.');
	process.exit(0);
}

console.log(`Running ${testFiles.length} test file(s):\n`);
for (const file of testFiles) {
	console.log(`  ${file}`);
}

const failedFiles: string[] = [];
for (const file of testFiles) {
	const exitCode = await new Promise<number>((resolve) => {
		const child = spawn(process.execPath, ['test', file], {
			cwd: ROOT_DIR,
			stdio: 'inherit',
		});
		child.on('exit', (code) => resolve(code ?? 1));
	});
	if (exitCode !== 0) {
		failedFiles.push(file);
	}
	console.log();
}

if (failedFiles.length === 0) {
	console.log(`✅ All ${testFiles.length} test file(s) passed.`);
	process.exit(0);
} else {
	console.error(
		`❌ ${failedFiles.length} of ${testFiles.length} test file(s) failed:`,
	);
	for (const file of failedFiles) {
		console.error(`   - ${file}`);
	}
	process.exit(1);
}
