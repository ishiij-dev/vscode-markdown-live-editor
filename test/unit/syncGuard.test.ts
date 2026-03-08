import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	consumeDocumentChange,
	markPendingEcho,
} from '../../src/provider/syncGuard';

describe('syncGuard', () => {
	it('skips exactly one echo-back change from webview', () => {
		let state = markPendingEcho('A');

		const first = consumeDocumentChange(state, 'A');
		assert.equal(first.skip, true);
		state = first.next;

		const second = consumeDocumentChange(state, 'A');
		assert.equal(second.skip, false);
	});

	it('does not skip external change with different text', () => {
		const state = markPendingEcho('A');
		const result = consumeDocumentChange(state, 'B');
		assert.equal(result.skip, false);
		assert.equal(result.next.pendingEchoContent, 'A');
	});

	it('keeps pending on non-match and skips on subsequent match', () => {
		let state = markPendingEcho('A');
		const nonMatch = consumeDocumentChange(state, 'B');
		assert.equal(nonMatch.skip, false);
		state = nonMatch.next;

		const match = consumeDocumentChange(state, 'A');
		assert.equal(match.skip, true);
	});

	it('allows external change back to old text after pending is consumed', () => {
		let state = markPendingEcho('A');
		state = consumeDocumentChange(state, 'A').next;

		const externalBack = consumeDocumentChange(state, 'A');
		assert.equal(externalBack.skip, false);
	});
});
