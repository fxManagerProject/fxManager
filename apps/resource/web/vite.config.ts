import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [react()],
	base: './',
	build: {
		outDir: '../dist/web',
		emptyOutDir: true,
		rollupOptions: {
			output: {
				assetFileNames: 'assets/[name][extname]',
				entryFileNames: 'assets/[name].js',
				chunkFileNames: 'assets/[name].js',
			},
		},
	},
	resolve: {
		alias: {
			'~': path.resolve(__dirname, './src'),
			'@common': path.resolve(__dirname, '../src/common'),
		},
	},
});
