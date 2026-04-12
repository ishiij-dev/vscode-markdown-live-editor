import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
	cleanupTableBr,
	countLogicalTextLines,
	countParagraphRowsFromHardBreaks,
	countText,
	dedupeNearbyRowTops,
	headingsEqual,
	shouldMergeNearbyTop,
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

describe('dedupeNearbyRowTops', () => {
	it('merges nearby tops with threshold and keeps sorted order', () => {
		const tops = [30, 10, 10.9, 50, 51.2, 80];
		const actual = dedupeNearbyRowTops(tops, 1.5);
		assert.deepEqual(actual, [10, 30, 50, 80]);
	});
});

describe('countParagraphRowsFromHardBreaks', () => {
	it('returns hardBreakCount + 1 with minimum 1', () => {
		assert.equal(countParagraphRowsFromHardBreaks(0), 1);
		assert.equal(countParagraphRowsFromHardBreaks(1), 2);
		assert.equal(countParagraphRowsFromHardBreaks(3), 4);
	});
});

describe('countLogicalTextLines', () => {
	it('counts CRLF/LF/CR line endings consistently', () => {
		assert.equal(countLogicalTextLines('a\nb\nc'), 3);
		assert.equal(countLogicalTextLines('a\r\nb\r\nc'), 3);
		assert.equal(countLogicalTextLines('a\rb\rc'), 3);
		assert.equal(countLogicalTextLines('single line'), 1);
	});
});

describe('shouldMergeNearbyTop', () => {
	it('returns true when tops are within threshold', () => {
		assert.equal(shouldMergeNearbyTop(101, 100, 4), true);
		assert.equal(shouldMergeNearbyTop(103.9, 100, 4), true);
	});

	it('returns false when tops are outside threshold', () => {
		assert.equal(shouldMergeNearbyTop(104, 100, 4), false);
		assert.equal(shouldMergeNearbyTop(110, 100, 4), false);
	});
});
