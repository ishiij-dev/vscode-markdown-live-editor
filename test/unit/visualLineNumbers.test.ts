import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldRenderVisualLineNumbersUpdate } from '../../src/view/visualLineNumbersUtils';

describe('shouldRenderVisualLineNumbersUpdate', () => {
	it('returns false when updates are blocked', () => {
		assert.equal(
			shouldRenderVisualLineNumbersUpdate({
				isBlocked: true,
				enabled: true,
				docChanged: true,
				selChanged: true,
			}),
			false,
		);
	});

	it('returns false when feature is disabled', () => {
		assert.equal(
			shouldRenderVisualLineNumbersUpdate({
				isBlocked: false,
				enabled: false,
				docChanged: true,
				selChanged: true,
			}),
			false,
		);
	});

	it('returns true when enabled and either doc or selection changed', () => {
		assert.equal(
			shouldRenderVisualLineNumbersUpdate({
				isBlocked: false,
				enabled: true,
				docChanged: true,
				selChanged: false,
			}),
			true,
		);
		assert.equal(
			shouldRenderVisualLineNumbersUpdate({
				isBlocked: false,
				enabled: true,
				docChanged: false,
				selChanged: true,
			}),
			true,
		);
	});

	it('returns false when nothing changed', () => {
		assert.equal(
			shouldRenderVisualLineNumbersUpdate({
				isBlocked: false,
				enabled: true,
				docChanged: false,
				selChanged: false,
			}),
			false,
		);
	});
});
