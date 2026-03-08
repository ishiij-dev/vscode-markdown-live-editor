import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldAutoPairInput } from '../../src/view/autoPairLogic';

describe('shouldAutoPairInput', () => {
	it('returns true for basic pair characters', () => {
		assert.equal(
			shouldAutoPairInput({
				text: '(',
				beforeChar: '',
				isComposing: false,
				isCodeContext: false,
			}),
			true,
		);
		assert.equal(
			shouldAutoPairInput({
				text: '[',
				beforeChar: ' ',
				isComposing: false,
				isCodeContext: false,
			}),
			true,
		);
	});

	it('returns false for non-pair text or multi-char input', () => {
		assert.equal(
			shouldAutoPairInput({
				text: 'a',
				beforeChar: '',
				isComposing: false,
				isCodeContext: false,
			}),
			false,
		);
		assert.equal(
			shouldAutoPairInput({
				text: '``',
				beforeChar: '',
				isComposing: false,
				isCodeContext: false,
			}),
			false,
		);
	});

	it('returns false while composing or in code context', () => {
		assert.equal(
			shouldAutoPairInput({
				text: '(',
				beforeChar: '',
				isComposing: true,
				isCodeContext: false,
			}),
			false,
		);
		assert.equal(
			shouldAutoPairInput({
				text: '(',
				beforeChar: '',
				isComposing: false,
				isCodeContext: true,
			}),
			false,
		);
	});

	it('avoids quote/backtick auto pair after word chars', () => {
		assert.equal(
			shouldAutoPairInput({
				text: "'",
				beforeChar: 'n',
				isComposing: false,
				isCodeContext: false,
			}),
			false,
		);
		assert.equal(
			shouldAutoPairInput({
				text: '"',
				beforeChar: 'a',
				isComposing: false,
				isCodeContext: false,
			}),
			false,
		);
		assert.equal(
			shouldAutoPairInput({
				text: '`',
				beforeChar: 'x',
				isComposing: false,
				isCodeContext: false,
			}),
			false,
		);
	});
});
