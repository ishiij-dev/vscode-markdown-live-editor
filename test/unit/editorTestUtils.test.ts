import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	clampSelectionRange,
	cleanupTableBr,
	countText,
	headingsEqual,
	type HeadingData,
} from '../../src/view/editorTestUtils';

describe('cleanupTableBr', () => {
	it('removes <br /> only in table rows', () => {
		const input = ['| col1 | col2 |', '| --- | --- |', '| a<br />b | c |', 'paragraph<br />keep'].join('\n');

		const actual = cleanupTableBr(input);
		assert.equal(actual, ['| col1 | col2 |', '| --- | --- |', '| ab | c |', 'paragraph<br />keep'].join('\n'));
	});
});

describe('countText', () => {
	it('counts words and characters', () => {
		const result = countText('hello  world\nmarkdown');
		assert.deepEqual(result, { words: 3, characters: 21 });
	});
});

describe('headingsEqual', () => {
	it('returns true when headings are equal', () => {
		const a: HeadingData[] = [
			{ text: 'A', level: 1, pos: 1 },
			{ text: 'B', level: 2, pos: 10 },
		];
		const b: HeadingData[] = [
			{ text: 'A', level: 1, pos: 1 },
			{ text: 'B', level: 2, pos: 10 },
		];
		assert.equal(headingsEqual(a, b), true);
	});

	it('returns false when headings differ', () => {
		const a: HeadingData[] = [{ text: 'A', level: 1, pos: 1 }];
		const b: HeadingData[] = [{ text: 'A', level: 2, pos: 1 }];
		assert.equal(headingsEqual(a, b), false);
	});
});

describe('clampSelectionRange', () => {
	it('clamps from/to into document bounds', () => {
		const result = clampSelectionRange(-3, 99, 10);
		assert.deepEqual(result, { from: 0, to: 10 });
	});

	it('keeps valid positions unchanged', () => {
		const result = clampSelectionRange(2, 5, 10);
		assert.deepEqual(result, { from: 2, to: 5 });
	});
});
