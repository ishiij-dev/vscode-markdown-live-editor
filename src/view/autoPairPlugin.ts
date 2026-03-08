import type { EditorState } from '@milkdown/prose/state';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import { AUTO_PAIR_MAP, shouldAutoPairInput } from './autoPairLogic';

function getNeighborText(
	state: EditorState,
	from: number,
): {
	before: string;
	after: string;
} {
	const before = from > 0 ? state.doc.textBetween(from - 1, from, '', '') : '';
	const after = state.doc.textBetween(from, from + 1, '', '');
	return { before, after };
}

function isCodeContext(state: EditorState): boolean {
	const { from, to, $from, $to } = state.selection;
	if (($from.parent.type.spec.code as boolean | undefined) === true) {
		return true;
	}
	if (($to.parent.type.spec.code as boolean | undefined) === true) {
		return true;
	}

	// Inline code mark context
	if ($from.marks().some((m) => m.type.name === 'code')) {
		return true;
	}
	if ($to.marks().some((m) => m.type.name === 'code')) {
		return true;
	}

	// Explicitly check any covered range for code_block node
	if (from !== to) {
		let hasCodeBlock = false;
		state.doc.nodesBetween(from, to, (node) => {
			if (node.type.spec.code === true || node.type.name === 'code_block') {
				hasCodeBlock = true;
				return false;
			}
			return true;
		});
		if (hasCodeBlock) {
			return true;
		}
	}

	return false;
}

function applyAutoPair(
	view: EditorView,
	from: number,
	to: number,
	open: string,
	close: string,
): boolean {
	const { state, dispatch } = view;
	const tr = state.tr;

	if (from !== to) {
		// Insert closing first so the start position remains stable.
		// This preserves marks/nodes inside the selected range.
		tr.insertText(close, to, to);
		tr.insertText(open, from, from);
		tr.setSelection(
			TextSelection.create(tr.doc, from + open.length, to + open.length),
		);
		dispatch(tr.scrollIntoView());
		return true;
	}

	tr.insertText(`${open}${close}`, from, to);
	tr.setSelection(TextSelection.create(tr.doc, from + open.length));
	dispatch(tr.scrollIntoView());
	return true;
}

export const autoPairPlugin = $prose(() => {
	return new Plugin({
		props: {
			handleTextInput(view, from, to, text) {
				const { state } = view;
				if (
					!shouldAutoPairInput({
						text,
						beforeChar: getNeighborText(state, from).before,
						isComposing: view.composing,
						isCodeContext: isCodeContext(state),
					})
				) {
					return false;
				}

				const close = AUTO_PAIR_MAP[text];
				return applyAutoPair(view, from, to, text, close);
			},
		},
	});
});
