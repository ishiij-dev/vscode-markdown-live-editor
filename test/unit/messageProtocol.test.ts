import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	isEditorToHostMessage,
	isHostToEditorMessage,
} from '../../src/protocol/messages';

describe('isHostToEditorMessage', () => {
	it('accepts valid init and control messages', () => {
		assert.equal(
			isHostToEditorMessage({
				type: 'init',
				body: '# title',
				documentDirUri: 'vscode-webview-resource://dir',
			}),
			true,
		);
		assert.equal(
			isHostToEditorMessage({ type: 'scrollToHeading', pos: 10 }),
			true,
		);
		assert.equal(
			isHostToEditorMessage({ type: 'requestHeadings' }),
			true,
		);
	});

	it('rejects invalid host messages', () => {
		assert.equal(isHostToEditorMessage({ type: 'init', body: 'x' }), false);
		assert.equal(
			isHostToEditorMessage({ type: 'scrollToHeading', pos: '10' }),
			false,
		);
		assert.equal(isHostToEditorMessage({ type: 'unknown' }), false);
	});
});

describe('isEditorToHostMessage', () => {
	it('accepts valid editor messages', () => {
		assert.equal(isEditorToHostMessage({ type: 'ready' }), true);
		assert.equal(
			isEditorToHostMessage({ type: 'update', body: '# text' }),
			true,
		);
		assert.equal(
			isEditorToHostMessage({
				type: 'headings',
				items: [{ text: 'H1', level: 1, pos: 0 }],
			}),
			true,
		);
		assert.equal(
			isEditorToHostMessage({
				type: 'wordCount',
				words: 10,
				characters: 42,
				selection: { words: 2, characters: 8 },
			}),
			true,
		);
	});

	it('rejects invalid editor messages', () => {
		assert.equal(
			isEditorToHostMessage({
				type: 'headings',
				items: [{ text: 'H1', level: '1', pos: 0 }],
			}),
			false,
		);
		assert.equal(
			isEditorToHostMessage({
				type: 'wordCount',
				words: 10,
				characters: 42,
				selection: { words: '2', characters: 8 },
			}),
			false,
		);
		assert.equal(isEditorToHostMessage({ type: 'wordCount' }), false);
	});
});
