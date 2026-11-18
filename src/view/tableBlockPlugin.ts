import { tableBlock, tableBlockConfig } from '@milkdown/components/table-block';
import type { Ctx } from '@milkdown/ctx';
import { GapCursor, gapCursor } from '@milkdown/prose/gapcursor';
import { Plugin } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';
import { backspaceAfterTable } from './tableBoundaryBackspace.mjs';

// 16x16 SVG icons using currentColor for VS Code theme integration
const plusIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M7.25 3a.75.75 0 0 1 1.5 0v4.25H13a.75.75 0 0 1 0 1.5H8.75V13a.75.75 0 0 1-1.5 0V8.75H3a.75.75 0 0 1 0-1.5h4.25V3Z"/></svg>';

const deleteIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.749.749 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.749.749 0 1 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z"/></svg>';

const alignLeftIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 1 7.75Zm0 5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75Z"/></svg>';

const alignCenterIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm2 5A.75.75 0 0 1 3.75 7h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 3 7.75Zm-2 5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75Z"/></svg>';

const alignRightIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm4 5A.75.75 0 0 1 5.75 7h8.5a.75.75 0 0 1 0 1.5h-8.5A.75.75 0 0 1 5 7.75Zm-4 5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1-.75-.75Z"/></svg>';

const dragHandleIcon =
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16"><path fill="currentColor" d="M5.5 3a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Zm5 0a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM7 8a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Zm3.5-1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3ZM7 13a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Zm3.5-1.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3Z"/></svg>';

export { tableBlock };

export const tableBoundaryBackspace = $prose(() => {
	const gap = gapCursor();
	return new Plugin({
		props: {
			decorations: gap.props.decorations,
			handleDOMEvents: gap.props.handleDOMEvents,
			handleKeyDown(view, event) {
				if (event.isComposing || view.composing) return false;
				if (event.key === 'Backspace') {
					return backspaceAfterTable(view.state, view.dispatch);
				}
				return (
					view.state.selection instanceof GapCursor &&
					gap.props.handleKeyDown?.call(gap, view, event) === true
				);
			},
		},
	});
});

export function configureTableBlock(ctx: Ctx): void {
	ctx.update(tableBlockConfig.key, (defaultConfig) => ({
		...defaultConfig,
		renderButton: (renderType: string) => {
			switch (renderType) {
				case 'add_row':
				case 'add_col':
					return plusIcon;
				case 'delete_row':
				case 'delete_col':
					return deleteIcon;
				case 'align_col_left':
					return alignLeftIcon;
				case 'align_col_center':
					return alignCenterIcon;
				case 'align_col_right':
					return alignRightIcon;
				case 'col_drag_handle':
				case 'row_drag_handle':
					return dragHandleIcon;
				default:
					return '';
			}
		},
	}));
}
