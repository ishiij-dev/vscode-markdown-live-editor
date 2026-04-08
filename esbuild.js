const esbuild = require('esbuild');
const path = require('node:path');
const fs = require('node:fs');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(
					`    ${location.file}:${location.line}:${location.column}:`,
				);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * Plugin to copy style.css to media/ after build
 * @type {import('esbuild').Plugin}
 */
const copyStylePlugin = {
	name: 'copy-style',
	setup(build) {
		build.onEnd(() => {
			const src = path.resolve(__dirname, 'src/view/style.css');
			const dest = path.resolve(__dirname, 'media/style.css');
			fs.mkdirSync(path.dirname(dest), { recursive: true });
			fs.copyFileSync(src, dest);
		});
	},
};

/**
 * Plugin to copy KaTeX CSS and font files to media/
 * @type {import('esbuild').Plugin}
 */
const copyKatexAssetsPlugin = {
	name: 'copy-katex-assets',
	setup(build) {
		build.onEnd(() => {
			const katexDist = path.resolve(__dirname, 'node_modules/katex/dist');
			const mediaDest = path.resolve(__dirname, 'media');

			// Copy katex.min.css
			fs.copyFileSync(
				path.join(katexDist, 'katex.min.css'),
				path.join(mediaDest, 'katex.min.css'),
			);

			// Copy fonts directory
			const fontsSrc = path.join(katexDist, 'fonts');
			const fontsDest = path.join(mediaDest, 'fonts');
			fs.mkdirSync(fontsDest, { recursive: true });
			for (const file of fs.readdirSync(fontsSrc)) {
				// Only copy woff2 for modern browsers
				if (file.endsWith('.woff2')) {
					fs.copyFileSync(
						path.join(fontsSrc, file),
						path.join(fontsDest, file),
					);
				}
			}
		});
	},
};

async function main() {
	// Extension Host bundle (desktop / Node.js)
	const extCtx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	// Extension Host bundle (web / browser worker)
	const webExtCtx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/web/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	// Webview bundle (browser)
	const viewCtx = await esbuild.context({
		entryPoints: ['src/view/view.ts'],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'media/view.js',
		logLevel: 'silent',
		define: {
			__VUE_OPTIONS_API__: 'false',
			__VUE_PROD_DEVTOOLS__: 'false',
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
		},
		plugins: [
			esbuildProblemMatcherPlugin,
			copyStylePlugin,
			copyKatexAssetsPlugin,
		],
	});

	// Mermaid bundle (browser, separate lazy-loaded file)
	const mermaidCtx = await esbuild.context({
		entryPoints: ['src/view/mermaid-entry.ts'],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'media/mermaid.js',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	if (watch) {
		await Promise.all([
			extCtx.watch(),
			webExtCtx.watch(),
			viewCtx.watch(),
			mermaidCtx.watch(),
		]);
	} else {
		await Promise.all([
			extCtx.rebuild(),
			webExtCtx.rebuild(),
			viewCtx.rebuild(),
			mermaidCtx.rebuild(),
		]);
		await Promise.all([
			extCtx.dispose(),
			webExtCtx.dispose(),
			viewCtx.dispose(),
			mermaidCtx.dispose(),
		]);
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
