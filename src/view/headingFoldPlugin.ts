import type { Ctx } from '@milkdown/ctx';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import {
	type EditorState,
	Plugin,
	PluginKey,
	type Transaction,
} from '@milkdown/prose/state';
import {
	Decoration,
	DecorationSet,
	type EditorView,
} from '@milkdown/prose/view';
import { $prose } from '@milkdown/utils';

interface FoldState {
	folded: number[];
}

type FoldAction = { type: 'toggle'; pos: number };

interface HeadingRange {
	pos: number;
	level: number;
	nodeSize: number;
	end: number;
}

const initialState: FoldState = { folded: [] };
export const headingFoldPluginKey = new PluginKey<FoldState>(
	'heading-fold-plugin',
);

function mapFoldedPositions(tr: Transaction, prev: FoldState): number[] {
	const mapped = prev.folded
		.map((pos) => tr.mapping.mapResult(pos, 1))
		.filter((result) => !result.deleted)
		.map((result) => result.pos);
	return Array.from(new Set(mapped)).sort((a, b) => a - b);
}

function isHeadingAtPos(doc: ProseMirrorNode, pos: number): boolean {
	return doc.nodeAt(pos)?.type.name === 'heading';
}

function applyFoldAction(
	action: FoldAction,
	prevFolded: number[],
	doc: ProseMirrorNode,
): number[] {
	if (!isHeadingAtPos(doc, action.pos)) {
		return prevFolded.filter((pos) => isHeadingAtPos(doc, pos));
	}

	if (prevFolded.includes(action.pos)) {
		return prevFolded.filter((pos) => pos !== action.pos);
	}
	return [...prevFolded, action.pos].sort((a, b) => a - b);
}

function collectHeadingRanges(doc: ProseMirrorNode): HeadingRange[] {
	const headings: HeadingRange[] = [];
	doc.descendants((node, pos) => {
		if (node.type.name !== 'heading') return;
		headings.push({
			pos,
			level: node.attrs.level as number,
			nodeSize: node.nodeSize,
			end: doc.content.size,
		});
	});

	for (let i = 0; i < headings.length; i++) {
		const current = headings[i];
		for (let j = i + 1; j < headings.length; j++) {
			const next = headings[j];
			if (next.level <= current.level) {
				current.end = next.pos;
				break;
			}
		}
	}
	return headings;
}

function createFoldDecorations(
	doc: ProseMirrorNode,
	state: FoldState,
): DecorationSet {
	const ranges = collectHeadingRanges(doc);
	const foldedSet = new Set(state.folded);
	const decorations: Decoration[] = [];

	for (const heading of ranges) {
		const isFolded = foldedSet.has(heading.pos);
		decorations.push(
			Decoration.widget(
				heading.pos + 1,
				() => {
					const button = document.createElement('button');
					button.type = 'button';
					button.className = 'heading-fold-toggle';
					button.dataset.headingPos = String(heading.pos);
					button.title = isFolded ? 'Expand section' : 'Collapse section';
					button.setAttribute(
						'aria-label',
						isFolded ? 'Expand section' : 'Collapse section',
					);
					button.textContent = isFolded ? '▸' : '▾';
					return button;
				},
				{
					side: -1,
				},
			),
		);

		if (!isFolded) continue;

		const hideFrom = heading.pos + heading.nodeSize;
		const hideTo = heading.end;
		if (hideFrom >= hideTo) continue;

		doc.descendants((node, pos) => {
			if (!node.isBlock) return;
			if (pos < hideFrom || pos + node.nodeSize > hideTo) return;
			decorations.push(
				Decoration.node(pos, pos + node.nodeSize, {
					class: 'heading-fold-hidden',
				}),
			);
		});
	}

	return DecorationSet.create(doc, decorations);
}

function getHeadingPosFromTarget(target: EventTarget | null): number | null {
	if (!(target instanceof HTMLElement)) return null;
	const toggle = target.closest<HTMLElement>('.heading-fold-toggle');
	if (!toggle) return null;
	const pos = Number(toggle.dataset.headingPos);
	return Number.isNaN(pos) ? null : pos;
}

function dispatchToggle(view: EditorView, pos: number): void {
	view.dispatch(
		view.state.tr.setMeta(headingFoldPluginKey, {
			type: 'toggle',
			pos,
		} satisfies FoldAction),
	);
	view.focus();
}

export const headingFoldPlugin = $prose((_ctx: Ctx) => {
	return new Plugin<FoldState>({
		key: headingFoldPluginKey,
		state: {
			init() {
				return initialState;
			},
			apply(tr, prev) {
				let folded = prev.folded;
				if (tr.docChanged) {
					folded = mapFoldedPositions(tr, prev).filter((pos) =>
						isHeadingAtPos(tr.doc, pos),
					);
				}

				const action = tr.getMeta(headingFoldPluginKey) as
					| FoldAction
					| undefined;
				if (!action) {
					return { folded };
				}

				if (action.type !== 'toggle') {
					return { folded };
				}
				return {
					folded: applyFoldAction(action, folded, tr.doc),
				};
			},
		},
		props: {
			decorations(state: EditorState) {
				const foldState = headingFoldPluginKey.getState(state) ?? initialState;
				return createFoldDecorations(state.doc, foldState);
			},
			handleDOMEvents: {
				mousedown(view: EditorView, event: MouseEvent) {
					const pos = getHeadingPosFromTarget(event.target);
					if (pos === null) return false;

					event.preventDefault();
					dispatchToggle(view, pos);
					return true;
				},
				keydown(view: EditorView, event: KeyboardEvent) {
					if (event.key !== 'Enter' && event.key !== ' ') return false;
					const pos = getHeadingPosFromTarget(event.target);
					if (pos === null) return false;

					event.preventDefault();
					dispatchToggle(view, pos);
					return true;
				},
			},
		},
	});
});
