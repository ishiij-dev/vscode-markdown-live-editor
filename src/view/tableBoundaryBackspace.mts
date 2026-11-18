import { GapCursor } from '@milkdown/prose/gapcursor';
import type { Node } from '@milkdown/prose/model';
import { type Command, Selection, TextSelection } from '@milkdown/prose/state';

export const backspaceAfterTable: Command = (state, dispatch) => {
	const { selection } = state;
	const { $from } = selection;
	if (selection instanceof GapCursor) {
		return $from.nodeBefore?.type.name === 'table';
	}
	if (
		!(selection instanceof TextSelection) ||
		!selection.empty ||
		$from.parentOffset !== 0 ||
		$from.parent.type.name !== 'paragraph' ||
		state.doc.resolve($from.before()).nodeBefore?.type.name !== 'table'
	) {
		return false;
	}

	// The default Backspace handler would select the table at this boundary.
	if ($from.parent.content.size === 0 && dispatch) {
		const start = $from.before();
		const tr = state.tr.delete(start, $from.after());
		const boundary = tr.doc.resolve(start);
		tr.setSelection(
			Selection.findFrom(boundary, 1, true) ?? new GapCursor(boundary),
		);
		dispatch(tr.scrollIntoView());
	}
	return true;
};

export function preserveTrailingTableBlankLine(
	markdown: string,
	doc: Node,
): string {
	let index = doc.childCount - 1;
	const last = index;
	while (index >= 0) {
		const node = doc.child(index);
		if (node.type.name !== 'paragraph' || node.content.size !== 0) break;
		index--;
	}
	// Milkdown omits the final empty paragraph. Preserve it so deleting
	// a blank line after the final table still changes the serialized text.
	if (index < last && index >= 0 && doc.child(index).type.name === 'table') {
		return `${markdown.trimEnd()}\n\n<br />\n`;
	}
	return markdown;
}
