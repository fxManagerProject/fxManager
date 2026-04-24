import { join } from 'path';
import drizzleConfig from '../drizzle.config';
import { migrations } from '../packages/database/src/migrations';
import { createInterface } from 'readline/promises';

if (!drizzleConfig.out) {
	throw new Error('Drizzle Config "out" field is not defined.');
}

const migrationDir = join(import.meta.dir, '..', drizzleConfig.out);
const migrationMetaDir = join(migrationDir, 'meta', '_journal.json');
const journalFile = Bun.file(migrationMetaDir);

if (!(await journalFile.exists())) {
	throw new Error(`Journal not found at ${migrationMetaDir}`);
}

interface Journal {
	entries: { tag: string }[];
}

const journal = (await journalFile.json()) as Journal;
const existingVersions = new Set(migrations.map((m) => m.version));

const pendingEntries = journal.entries
	.map(({ tag }) => ({
		tag,
		version: parseInt(tag.substring(0, 4), 10),
	}))
	.filter(({ version }) => !existingVersions.has(version));

if (pendingEntries.length === 0) {
	console.log('Local migrations are up to date.');
	process.exit(0);
}

function sanitizeSql(sql: string): string[] {
	return sql
		.replace(/\/\*[\s\S]*?\*\//g, '') // remove multiline comments
		.replace(/--.*$/gm, '') // remove single line comments
		.split(';') // split into individual queries
		.map((query) => query.trim().replace(/`/g, '\\`')) // clean up whitespace/newlines
		.filter((query) => query.length > 0); // remove empty entries
}

const rl = createInterface({
	input: process.stdin,
	output: process.stdout,
});

const targetMigrationDir = join(
	import.meta.dir,
	'..',
	'packages',
	'database',
	'src',
	'migrations',
	'migrations',
);

/**
 * updates the central index.ts acting as migration registry
 */
async function updateMigrationRegistry(varName: string, tag: string) {
	const indexPath = join(targetMigrationDir, 'index.ts');
	let content = await Bun.file(indexPath).text();

	const importLine = `import { ${varName} } from './${tag}';\n`;
	if (!content.includes(importLine)) {
		content = importLine + content;
	}

	const arrayRegex = /(export const migrations: Migration\[\] = \[)(.*)(\];)/s;
	content = content.replace(arrayRegex, (_, start, middle, end) => {
		const currentItems = middle.trim();
		const newItems = currentItems ? `${currentItems}, ${varName}` : varName;
		return `${start}${newItems}${end}`;
	});

	await Bun.write(indexPath, content);
}

for (const { tag, version } of pendingEntries) {
	const rawSql = await Bun.file(join(migrationDir, `${tag}.sql`)).text();
	const queries = sanitizeSql(rawSql);

	console.log(`\nMigration: ${tag}`);
	const description = await rl.question('Description: ');

	const varName = `m${tag}`;

	const formattedQueries = queries
		.map((query) => {
			const lines = query.split('\n');
			if (lines.length === 1) return `    \`${lines[0]}\``;

			const indentedLines = lines
				.map((line, i) => (i === 0 ? line : `    ${line}`)) // indent sub-lines
				.join('\n');

			return `    \`${indentedLines}\``;
		})
		.join(',\n');

	const fileContent = `import type { Migration } from '../types';

export const ${varName}: Migration = {
  version: ${version},
  description: ${JSON.stringify(description)},
  up: [
${formattedQueries}
  ]
};`;

	await Bun.write(join(targetMigrationDir, `${tag}.ts`), fileContent);
	await updateMigrationRegistry(varName, tag);

	console.log(`Processed ${tag}`);
}

rl.close();
