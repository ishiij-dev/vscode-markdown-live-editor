import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { history, redo, redoDepth, undo, undoDepth } from 'prosemirror-history';
import { Schema } from 'prosemirror-model';
import { EditorState, type Transaction } from 'prosemirror-state';
import {
	createHistoryKeyBindings,
	excludeFromUndoHistory,
} from '../../src/view/history';

const historyKeyBindings = createHistoryKeyBindings(undo, redo);

const schema = new Schema({
	nodes: {
		doc: { content: 'text*' },
		text: {},
	},
});

function createState(text: string): EditorState {
	return EditorState.create({
		doc: schema.node('doc', null, text ? [schema.text(text)] : []),
		plugins: [history()],
	});
}

function dispatchTo(
	getState: () => EditorState,
	setState: (state: EditorState) => void,
): (transaction: Transaction) => void {
	return (transaction) => {
		setState(getState().apply(transaction));
	};
}

describe('history plugin', () => {
	it('undoes and redoes editor changes through the configured bindings', () => {
		let state = createState('Hello');
		const dispatch = dispatchTo(
			() => state,
			(nextState) => {
				state = nextState;
			},
		);

		state = state.apply(
			state.tr.insertText(' world', state.doc.content.size),
		);
		assert.equal(state.doc.textContent, 'Hello world');
		assert.equal(undoDepth(state), 1);

		assert.equal(historyKeyBindings['Mod-z'](state, dispatch), true);
		assert.equal(state.doc.textContent, 'Hello');
		assert.equal(redoDepth(state), 1);

		assert.equal(historyKeyBindings['Shift-Mod-z'](state, dispatch), true);
		assert.equal(state.doc.textContent, 'Hello world');

		assert.equal(historyKeyBindings['Mod-z'](state, dispatch), true);
		assert.equal(historyKeyBindings['Mod-y'](state, dispatch), true);
		assert.equal(state.doc.textContent, 'Hello world');
	});

	it('maps standard platform shortcuts to ProseMirror history commands', () => {
		assert.equal(historyKeyBindings['Mod-z'], undo);
		assert.equal(historyKeyBindings['Shift-Mod-z'], redo);
		assert.equal(historyKeyBindings['Mod-y'], redo);
	});

	it('does not add host-driven replacements to undo history', () => {
		let state = createState('Local');
		const externalDoc = schema.node('doc', null, [schema.text('External')]);
		const externalUpdate = state.tr.replaceWith(
			0,
			state.doc.content.size,
			externalDoc.content,
		);

		state = state.apply(excludeFromUndoHistory(externalUpdate));

		assert.equal(state.doc.textContent, 'External');
		assert.equal(undoDepth(state), 0);
		assert.equal(undo(state), false);

		state = state.apply(
			state.tr.insertText(' edit', state.doc.content.size),
		);
		assert.equal(undoDepth(state), 1);

		undo(state, (transaction) => {
			state = state.apply(transaction);
		});
		assert.equal(state.doc.textContent, 'External');
	});
});
