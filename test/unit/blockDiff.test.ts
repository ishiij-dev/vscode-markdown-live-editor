import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	changedBlockRange,
	type DiffableBlock,
} from '../../src/view/blockDiffUtils';

interface FakeBlock extends DiffableBlock<FakeBlock> {
	readonly id: string;
}

function block(id: string, nodeSize = 3): FakeBlock {
	return {
		id,
		nodeSize,
		eq(other: FakeBlock) {
			return other.id === id && other.nodeSize === nodeSize;
		},
	};
}

/**
 * Expands blocks into position space, applies the computed replacement and
 * checks the result equals the incoming document. This is the property the
 * range has to satisfy for the ProseMirror transaction to be correct.
 */
function assertSpliceMatches(
	current: readonly FakeBlock[],
	incoming: readonly FakeBlock[],
): void {
	const expand = (blocks: readonly FakeBlock[]) =>
		blocks.flatMap((b) => Array.from({ length: b.nodeSize }, () => b.id));

	const { from, to, newFrom, newTo } = changedBlockRange(current, incoming);
	const flatCurrent = expand(current);
	const flatIncoming = expand(incoming);
	const spliced = [
		...flatCurrent.slice(0, from),
		...flatIncoming.slice(newFrom, newTo),
		...flatCurrent.slice(to),
	];

	assert.deepEqual(spliced, flatIncoming);
}

describe('changedBlockRange', () => {
	it('returns an empty range for identical documents', () => {
		const blocks = [block('a'), block('b')];
		assert.deepEqual(changedBlockRange(blocks, [block('a'), block('b')]), {
			from: 6,
			to: 6,
			newFrom: 6,
			newTo: 6,
		});
	});

	it('narrows the range to a changed block in the middle', () => {
		const current = [block('a'), block('b'), block('c')];
		const incoming = [block('a'), block('x'), block('c')];
		assert.deepEqual(changedBlockRange(current, incoming), {
			from: 3,
			to: 6,
			newFrom: 3,
			newTo: 6,
		});
		assertSpliceMatches(current, incoming);
	});

	it('handles appended, prepended and removed blocks', () => {
		const base = [block('a'), block('b')];
		assertSpliceMatches(base, [block('a'), block('b'), block('c')]);
		assertSpliceMatches(base, [block('z'), block('a'), block('b')]);
		assertSpliceMatches([block('a'), block('b'), block('c')], base);
	});

	it('handles empty documents on either side', () => {
		assertSpliceMatches([], [block('a')]);
		assertSpliceMatches([block('a')], []);
		assertSpliceMatches([], []);
	});

	it('handles blocks that changed size only', () => {
		assertSpliceMatches([block('a'), block('b', 3)], [block('a'), block('b', 9)]);
	});

	it('handles repeated identical blocks', () => {
		assertSpliceMatches(
			[block('a'), block('a'), block('a')],
			[block('a'), block('a')],
		);
		assertSpliceMatches([block('a'), block('b'), block('a')], [block('a')]);
	});
});
