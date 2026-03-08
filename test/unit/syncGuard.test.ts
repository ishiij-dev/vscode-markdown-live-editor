import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	PENDING_ECHO_TTL_MS,
	consumeDocumentChange,
	markPendingEcho,
} from '../../src/provider/syncGuard';

describe('syncGuard', () => {
	it('skips exactly one echo-back change from webview', () => {
		let state = markPendingEcho('A', 1000);

		const first = consumeDocumentChange(state, 'A', 1001);
		assert.equal(first.skip, true);
		state = first.next;

		const second = consumeDocumentChange(state, 'A', 1002);
		assert.equal(second.skip, false);
	});

	it('does not skip external change with different text', () => {
		const state = markPendingEcho('A', 1000);
		const result = consumeDocumentChange(state, 'B', 1001);
		assert.equal(result.skip, false);
		assert.equal(result.next.pendingEchoContent, 'A');
	});

	it('keeps pending on non-match and skips on subsequent match', () => {
		let state = markPendingEcho('A', 1000);
		const nonMatch = consumeDocumentChange(state, 'B', 1001);
		assert.equal(nonMatch.skip, false);
		state = nonMatch.next;

		const match = consumeDocumentChange(state, 'A', 1002);
		assert.equal(match.skip, true);
	});

	it('allows external change back to old text after pending is consumed', () => {
		let state = markPendingEcho('A', 1000);
		state = consumeDocumentChange(state, 'A', 1001).next;

		const externalBack = consumeDocumentChange(state, 'A', 1002);
		assert.equal(externalBack.skip, false);
	});

	it('does not skip when pending echo is stale', () => {
		const state = markPendingEcho('A', 1000);
		const stale = consumeDocumentChange(
			state,
			'A',
			1000 + PENDING_ECHO_TTL_MS + 1,
		);
		assert.equal(stale.skip, false);
		assert.equal(stale.next.pendingEchoContent, null);
	});
});
