import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	clampActiveIndex,
	findMatchesInSegments,
	moveToNextMatch,
	moveToPrevMatch,
	setSearchQuery,
} from '../../src/view/searchState';

describe('findMatchesInSegments', () => {
	it('finds matches with absolute positions (case-insensitive)', () => {
		const matches = findMatchesInSegments(
			[
				{ text: 'Hello', from: 5 },
				{ text: 'world hello', from: 20 },
			],
			'hello',
		);
		assert.deepEqual(matches, [
			{ from: 5, to: 10 },
			{ from: 26, to: 31 },
		]);
	});
});

describe('search state transitions', () => {
	it('starts active index at first match when query exists', () => {
		const state = setSearchQuery('a', [
			{ from: 1, to: 2 },
			{ from: 3, to: 4 },
		]);
		assert.equal(state.activeIndex, 0);
	});

	it('cycles next/prev within matches', () => {
		const initial = setSearchQuery('a', [
			{ from: 1, to: 2 },
			{ from: 3, to: 4 },
		]);
		assert.equal(moveToNextMatch(initial).activeIndex, 1);
		assert.equal(moveToNextMatch(moveToNextMatch(initial)).activeIndex, 0);
		assert.equal(moveToPrevMatch(initial).activeIndex, 1);
	});

	it('clamps invalid active index', () => {
		const clamped = clampActiveIndex({
			query: 'a',
			matches: [{ from: 1, to: 2 }],
			activeIndex: 10,
		});
		assert.equal(clamped.activeIndex, 0);
	});
});
