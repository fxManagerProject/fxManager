//@ts-check

import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({
	path: path.join(__dirname, '../../../.env'),
});

const DEPLOY_PATH = process.env.DEPLOY_PATH;

(async () => {
	if (!DEPLOY_PATH) {
		console.warn('DEPLOY_PATH not found in environment. Skipping sync.');
		return;
	}

	try {
		await fs.ensureDir(DEPLOY_PATH);

		const targets = [
			'web',
			'lib',
			'dist',
			'locales',
			'static',
			'fxmanifest.lua',
		];

		for (const target of targets) {
			if (await fs.pathExists(target)) {
				await fs.copy(target, path.join(DEPLOY_PATH, target), {
					overwrite: true,
					dereference: true,
				});
			}
		}
		console.log(`[Watcher] Successfully synced to: ${DEPLOY_PATH}`);
	} catch (err) {
		console.error(`[Watcher] Sync failed: ${err}`);
	}
})();
