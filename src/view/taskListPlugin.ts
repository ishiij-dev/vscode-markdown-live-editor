import type { Ctx } from '@milkdown/ctx';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { Plugin, PluginKey } from '@milkdown/prose/state';
import type { EditorView } from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';
import { isInsideTaskCheckbox } from './taskListLogic';

export const taskListPluginKey = new PluginKey('task-list-plugin');

const TASK_ITEM_SELECTOR = 'li[data-item-type="task"]';
const FALLBACK_FONT_SIZE_PX = 16;

interface TaskItem {
	pos: number;
	node: ProseMirrorNode;
}

/** The `list_item` ancestor of `li`, or null when it is not a task item. */
function findTaskItem(view: EditorView, li: HTMLElement): TaskItem | null {
	let pos: number;
	try {
		pos = view.posAtDOM(li, 0);
	} catch {
		return null;
	}

	const resolved = view.state.doc.resolve(pos);
	for (let depth = resolved.depth; depth >= 1; depth--) {
		const node = resolved.node(depth);
		if (node.type.name !== 'list_item') continue;
		// Plain (non-task) list items carry `checked: null`.
		if (node.attrs.checked == null) return null;
		return { pos: resolved.before(depth), node };
	}
	return null;
}

function toggleChecked(view: EditorView, item: TaskItem): void {
	view.dispatch(
		view.state.tr.setNodeMarkup(item.pos, undefined, {
			...item.node.attrs,
			checked: !item.node.attrs.checked,
		}),
	);
	view.focus();
}

/**
 * Makes GFM task list checkboxes clickable.
 *
 * The checkbox is a CSS pseudo-element, so it cannot receive events itself.
 * This resolves the click against the list item and toggles the `checked`
 * attribute, which serializes back to `- [x]` / `- [ ]`.
 */
export const taskListPlugin = $prose((_ctx: Ctx) => {
	return new Plugin({
		key: taskListPluginKey,
		props: {
			handleDOMEvents: {
				mousedown(view: EditorView, event: MouseEvent) {
					if (event.button !== 0) return false;

					const target = event.target;
					if (!(target instanceof HTMLElement)) return false;
					const li = target.closest<HTMLElement>(TASK_ITEM_SELECTOR);
					if (!li) return false;

					const rect = li.getBoundingClientRect();
					const fontSize =
						Number.parseFloat(getComputedStyle(li).fontSize) ||
						FALLBACK_FONT_SIZE_PX;
					const onCheckbox = isInsideTaskCheckbox({
						offsetX: event.clientX - rect.left,
						offsetY: event.clientY - rect.top,
						fontSize,
					});
					if (!onCheckbox) return false;

					const item = findTaskItem(view, li);
					if (!item) return false;

					// Keep the caret where it was instead of moving it into the item.
					event.preventDefault();
					toggleChecked(view, item);
					return true;
				},
			},
		},
	});
});
