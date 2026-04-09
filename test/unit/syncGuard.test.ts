import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	PENDING_ECHO_TTL_MS,
	consumeDocumentChange,
	markPendingEcho,
	normalizeForSync,
} from '../../src/provider/syncGuard';

describe('syncGuard', () => {
	it('skips exactly one echo-back change from webview', () => {
		let state = markPendingEcho('A', 2, 1000);

		const first = consumeDocumentChange(state, 'A', 2, 1001);
		assert.equal(first.skip, true);
		state = first.next;

		const second = consumeDocumentChange(state, 'A', 3, 1002);
		assert.equal(second.skip, false);
	});

	it('does not skip external change with different text', () => {
		const state = markPendingEcho('A', 2, 1000);
		const result = consumeDocumentChange(state, 'B', 3, 1001);
		assert.equal(result.skip, false);
		assert.equal(result.next.pendingEchoContent, 'A');
	});

	it('keeps pending on non-match and skips on subsequent version match', () => {
		let state = markPendingEcho('A', 2, 1000);
		const nonMatch = consumeDocumentChange(state, 'B', 3, 1001);
		assert.equal(nonMatch.skip, false);
		state = nonMatch.next;

		const match = consumeDocumentChange(state, 'A', 2, 1002);
		assert.equal(match.skip, true);
	});

	it('allows external change back to old text after pending is consumed', () => {
		let state = markPendingEcho('A', 2, 1000);
		state = consumeDocumentChange(state, 'A', 2, 1001).next;

		const externalBack = consumeDocumentChange(state, 'A', 3, 1002);
		assert.equal(externalBack.skip, false);
	});

	it('does not skip when pending echo is stale', () => {
		const state = markPendingEcho('A', 2, 1000);
		const stale = consumeDocumentChange(
			state,
			'A',
			2,
			1000 + PENDING_ECHO_TTL_MS + 1,
		);
		assert.equal(stale.skip, false);
		assert.equal(stale.next.pendingEchoContent, null);
	});

	it('skips echo-back when only line endings differ (CRLF/LF)', () => {
		const state = markPendingEcho('A\r\nB\r\n', 2, 1000);
		const result = consumeDocumentChange(state, 'A\nB\n', 5, 1001);
		assert.equal(result.skip, true);
	});

	it('skips echo-back when only a single EOF newline differs', () => {
		const state = markPendingEcho('A\n', 2, 1000);
		const result = consumeDocumentChange(state, 'A', 5, 1001);
		assert.equal(result.skip, true);
	});

	it('keeps pendingExpectedVersion in state', () => {
		const state = markPendingEcho('A', 42, 1000);
		assert.equal(state.pendingExpectedVersion, 42);
	});

	it('normalizes CRLF and a single EOF newline consistently', () => {
		assert.equal(normalizeForSync('A\r\nB\r\n'), 'A\nB');
		assert.equal(normalizeForSync('A\nB\n'), 'A\nB');
	});
});
