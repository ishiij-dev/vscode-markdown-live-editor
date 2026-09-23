/**
 * Minimal shape of a ProseMirror node needed to diff top-level blocks.
 * Declared structurally so this module stays free of ProseMirror imports
 * and can be unit tested with plain objects.
 */
export interface DiffableBlock<T> {
	readonly nodeSize: number;
	eq(other: T): boolean;
}

export interface ChangedBlockRange {
	/** Start of the replaced range, in current document positions. */
	from: number;
	/** End of the replaced range, in current document positions. */
	to: number;
	/** Start of the replacement slice, in incoming document positions. */
	newFrom: number;
	/** End of the replacement slice, in incoming document positions. */
	newTo: number;
}

function totalSize<T extends DiffableBlock<T>>(blocks: readonly T[]): number {
	let size = 0;
	for (const block of blocks) {
		size += block.nodeSize;
	}
	return size;
}

/**
 * Finds the smallest top-level block range that has to be replaced to turn
 * `current` into `incoming`, by skipping the blocks that are equal at the
 * start and at the end.
 *
 * Replacing the whole document maps every selection into a range that no
 * longer exists, so the caret is pushed to the end of the replacement. Keeping
 * the untouched blocks out of the transaction lets ProseMirror map the
 * selection normally, which keeps the caret in place whenever the change is
 * somewhere else in the document.
 *
 * When the documents are equal the returned range is empty (`from === to` and
 * `newFrom === newTo`), which makes the replacement a no-op.
 */
export function changedBlockRange<T extends DiffableBlock<T>>(
	current: readonly T[],
	incoming: readonly T[],
): ChangedBlockRange {
	const currentCount = current.length;
	const incomingCount = incoming.length;

	let prefix = 0;
	while (
		prefix < currentCount &&
		prefix < incomingCount &&
		current[prefix].eq(incoming[prefix])
	) {
		prefix += 1;
	}

	let suffix = 0;
	while (
		suffix < currentCount - prefix &&
		suffix < incomingCount - prefix &&
		current[currentCount - 1 - suffix].eq(incoming[incomingCount - 1 - suffix])
	) {
		suffix += 1;
	}

	let from = 0;
	let newFrom = 0;
	for (let i = 0; i < prefix; i += 1) {
		from += current[i].nodeSize;
		newFrom += incoming[i].nodeSize;
	}

	let to = totalSize(current);
	let newTo = totalSize(incoming);
	for (let i = 0; i < suffix; i += 1) {
		to -= current[currentCount - 1 - i].nodeSize;
		newTo -= incoming[incomingCount - 1 - i].nodeSize;
	}

	return { from, to, newFrom, newTo };
}
