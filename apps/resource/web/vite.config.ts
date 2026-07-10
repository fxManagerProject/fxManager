import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import postcssPresetEnv from 'postcss-preset-env';
import tailwindcss from '@tailwindcss/postcss';

export default defineConfig({
	plugins: [react()],
	base: './',
	css: {
		postcss: {
			plugins: [
				tailwindcss(),
				postcssPresetEnv({
					stage: 2,
					features: {
						'oklab-function': true,
						'custom-properties': true,
					},
					browsers: 'chrome >= 103',
				}),
			],
		},
	},
	build: {
		outDir: '../dist/web',
		emptyOutDir: true,
		target: 'chrome103',
		rollupOptions: {
			output: {
				assetFileNames: 'assets/[name][extname]',
				entryFileNames: 'assets/[name].js',
				chunkFileNames: 'assets/[name].js',
			},
		},
	},
});
