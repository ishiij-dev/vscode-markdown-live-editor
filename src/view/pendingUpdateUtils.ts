export type PendingUpdateDecision = 'apply' | 'discard' | 'wait';

export interface PendingUpdateInput {
	/** When the queued snapshot arrived from the extension host. */
	queuedAt: number;
	/** When the user last changed the document in the editor. */
	lastLocalEditAt: number;
	/** True while local edits have not been posted to the host yet. */
	hasUnsyncedLocalEdits: boolean;
}

/**
 * Decides what to do with a remote update that was queued because the editor
 * had focus.
 *
 * The queued body is a snapshot of the host document taken when the message
 * arrived, so it only reflects local edits the host already knew about:
 *
 * - If the user typed after the snapshot was taken, applying it would revert
 *   those keystrokes. Discard it instead; the newer local content reaches the
 *   host through the normal update debounce.
 * - If local edits have not been posted yet, the snapshot cannot contain them
 *   even though they are older than it, so wait until they have been sent.
 * - Otherwise the snapshot is at least as new as anything typed locally and is
 *   safe to apply.
 */
export function decidePendingUpdate(
	input: PendingUpdateInput,
): PendingUpdateDecision {
	if (input.lastLocalEditAt > input.queuedAt) return 'discard';
	if (input.hasUnsyncedLocalEdits) return 'wait';
	return 'apply';
}
