import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Node } from '@milkdown/prose/model';
import type { EditorState } from '@milkdown/prose/state';

async function fixture() {
	const { Schema } = await import('@milkdown/prose/model');
	const { EditorState, NodeSelection, TextSelection } = await import(
		'@milkdown/prose/state'
	);
	const { GapCursor } = await import('@milkdown/prose/gapcursor');
	const { tableNodes } = await import('@milkdown/prose/tables');
	const schema = new Schema({
		nodes: {
			doc: { content: 'block+' },
			paragraph: { group: 'block', content: 'inline*' },
			text: { group: 'inline' },
			...tableNodes({
				tableGroup: 'block',
				cellContent: 'paragraph',
				cellAttributes: {},
			}),
		},
	});
	const paragraph = (text = '') =>
		schema.node('paragraph', null, text ? schema.text(text) : []);
	const table = schema.node('table', null, [
		schema.node('table_row', null, [
			schema.node('table_cell', null, paragraph('Keep me')),
		]),
	]);
	const { backspaceAfterTable, preserveTrailingTableBlankLine } = await import(
		'../../src/view/tableBoundaryBackspace.mjs'
	);
	const press = (state: EditorState) => {
		let next = state;
		const handled = backspaceAfterTable(state, (tr) => {
			next = state.apply(tr);
		});
		return { handled, next };
	};
	const makeState = (blocks: Node[], position: number) => {
		const doc = schema.node('doc', null, blocks);
		return EditorState.create({
			doc,
			selection: TextSelection.create(doc, position),
		});
	};
	return {
		table,
		paragraph,
		GapCursor,
		NodeSelection,
		press,
		makeState,
		preserveTrailingTableBlankLine,
	};
}

describe('Backspace immediately after a table', () => {
	it('removes one empty paragraph and leaves the caret at the next paragraph', async () => {
		const { table, paragraph, press, makeState } = await fixture();
		const state = makeState(
			[table, paragraph(), paragraph('Next')],
			table.nodeSize + 1,
		);
		const { handled, next } = press(state);

		assert.ok(handled);
		assert.equal(next.doc.childCount, 2);
		assert.ok(next.doc.child(0).eq(table));
		assert.equal(next.selection.$from.parent.textContent, 'Next');
		assert.equal(next.selection.$from.parentOffset, 0);
		assert.deepEqual(press(next), { handled: true, next });
	});

	it('keeps the caret outside a terminal table and ignores another Backspace', async () => {
		const {
			table,
			paragraph,
			GapCursor,
			press,
			makeState,
			preserveTrailingTableBlankLine,
		} = await fixture();
		const state = makeState([table, paragraph()], table.nodeSize + 1);
		const markdown = '| A |\n| --- |\n| B |\n';

		assert.equal(
			preserveTrailingTableBlankLine(markdown, state.doc),
			`${markdown}\n<br />\n`,
		);
		const { handled, next } = press(state);
		assert.ok(handled);
		assert.ok(next.doc.firstChild?.eq(table));
		assert.equal(next.doc.childCount, 1);
		assert.ok(next.selection instanceof GapCursor);
		assert.equal(next.selection.from, table.nodeSize);
		assert.deepEqual(press(next), { handled: true, next });
		assert.equal(preserveTrailingTableBlankLine(markdown, next.doc), markdown);
	});

	it('lets the default handler handle edits inside text or an explicitly selected table', async () => {
		const { table, paragraph, NodeSelection, press, makeState } =
			await fixture();
		const state = makeState([table, paragraph('Next')], table.nodeSize + 2);
		assert.deepEqual(press(state), { handled: false, next: state });
		const selected = state.apply(
			state.tr.setSelection(NodeSelection.create(state.doc, 0)),
		);
		assert.deepEqual(press(selected), { handled: false, next: selected });
	});

	it('leaves a blank paragraph after ordinary text to the default handler', async () => {
		const { paragraph, press, makeState, preserveTrailingTableBlankLine } =
			await fixture();
		const text = paragraph('Text');
		const state = makeState([text, paragraph()], text.nodeSize + 1);
		assert.deepEqual(press(state), { handled: false, next: state });
		assert.equal(preserveTrailingTableBlankLine('Text\n', state.doc), 'Text\n');
	});
});
