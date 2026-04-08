import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const packageJsonPath = path.join(repoRoot, 'package.json');

describe('extension manifest smoke', () => {
	it('has core custom editor contribution', () => {
		const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as {
			main: string;
			browser?: string;
			contributes?: {
				customEditors?: Array<{ viewType: string }>;
				commands?: Array<{ command: string }>;
			};
		};

		assert.equal(pkg.main, './dist/extension.js');
		assert.equal(pkg.browser, './dist/web/extension.js');
		assert.ok(pkg.contributes?.customEditors?.some((e) => e.viewType === 'markdownLiveEditor.editor'));
		assert.ok(pkg.contributes?.commands?.some((c) => c.command === 'markdownLiveEditor.openEditor'));
	});

	it('has required source entry files', () => {
		assert.equal(fs.existsSync(path.join(repoRoot, 'src', 'extension.ts')), true);
		assert.equal(
			fs.existsSync(path.join(repoRoot, 'src', 'provider', 'markdownEditorProvider.ts')),
			true,
		);
		assert.equal(fs.existsSync(path.join(repoRoot, 'src', 'view', 'view.ts')), true);
	});
});
