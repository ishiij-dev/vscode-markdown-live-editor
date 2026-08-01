import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decidePendingUpdate } from '../../src/view/pendingUpdateUtils';

describe('decidePendingUpdate', () => {
	it('applies a snapshot taken after the last local edit', () => {
		assert.equal(
			decidePendingUpdate({
				queuedAt: 1000,
				lastLocalEditAt: 600,
				hasUnsyncedLocalEdits: false,
			}),
			'apply',
		);
	});

	it('discards a snapshot the user has typed past', () => {
		assert.equal(
			decidePendingUpdate({
				queuedAt: 1000,
				lastLocalEditAt: 1200,
				hasUnsyncedLocalEdits: false,
			}),
			'discard',
		);
	});

	it('discards even when the newer local edits are still unsynced', () => {
		assert.equal(
			decidePendingUpdate({
				queuedAt: 1000,
				lastLocalEditAt: 1200,
				hasUnsyncedLocalEdits: true,
			}),
			'discard',
		);
	});

	it('waits while older local edits have not reached the host', () => {
		assert.equal(
			decidePendingUpdate({
				queuedAt: 1000,
				lastLocalEditAt: 900,
				hasUnsyncedLocalEdits: true,
			}),
			'wait',
		);
	});

	it('applies when nothing has been typed at all', () => {
		assert.equal(
			decidePendingUpdate({
				queuedAt: 1000,
				lastLocalEditAt: 0,
				hasUnsyncedLocalEdits: false,
			}),
			'apply',
		);
	});
});
