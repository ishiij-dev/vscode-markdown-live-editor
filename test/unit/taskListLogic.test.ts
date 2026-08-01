import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isInsideTaskCheckbox } from '../../src/view/taskListLogic';

// The checkbox is drawn at left: 0, top: 0.25em, 1em square, with 2px of slop.
// At 16px that is x in [-2, 18] and y in [2, 22].
const fontSize = 16;

describe('isInsideTaskCheckbox', () => {
	it('returns true at the center of the checkbox', () => {
		assert.equal(
			isInsideTaskCheckbox({ offsetX: 8, offsetY: 12, fontSize }),
			true,
		);
	});

	it('returns true within the slop around each edge', () => {
		assert.equal(
			isInsideTaskCheckbox({ offsetX: -2, offsetY: 2, fontSize }),
			true,
		);
		assert.equal(
			isInsideTaskCheckbox({ offsetX: 18, offsetY: 22, fontSize }),
			true,
		);
	});

	it('returns false for the label text to the right of the checkbox', () => {
		assert.equal(
			isInsideTaskCheckbox({ offsetX: 40, offsetY: 12, fontSize }),
			false,
		);
	});

	it('returns false above and below the checkbox', () => {
		assert.equal(
			isInsideTaskCheckbox({ offsetX: 8, offsetY: 0, fontSize }),
			false,
		);
		assert.equal(
			isInsideTaskCheckbox({ offsetX: 8, offsetY: 30, fontSize }),
			false,
		);
	});

	it('returns false for a wrapped second line at the same x', () => {
		assert.equal(
			isInsideTaskCheckbox({
				offsetX: 8,
				offsetY: 12 + fontSize * 1.5,
				fontSize,
			}),
			false,
		);
	});

	it('scales with the item font size', () => {
		assert.equal(
			isInsideTaskCheckbox({ offsetX: 30, offsetY: 20, fontSize: 32 }),
			true,
		);
		assert.equal(
			isInsideTaskCheckbox({ offsetX: 30, offsetY: 20, fontSize: 12 }),
			false,
		);
	});
});
