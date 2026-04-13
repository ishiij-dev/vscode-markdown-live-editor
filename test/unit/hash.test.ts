import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hashText } from '../../src/shared/hash';

describe('hashText', () => {
	it('returns the same hash for identical input', () => {
		const a = hashText('markdown live editor');
		const b = hashText('markdown live editor');
		assert.equal(a, b);
	});

	it('returns different hashes for different input', () => {
		const a = hashText('markdown live editor');
		const b = hashText('markdown live editor.');
		assert.notEqual(a, b);
	});
});
