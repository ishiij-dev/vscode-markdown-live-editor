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
import {
	clampActiveIndex,
	emptySearchState,
	findMatchesInSegments,
	moveToNextMatch,
	moveToPrevMatch,
	type SearchState,
	type SearchTextSegment,
	setSearchQuery,
} from './searchState';

export const searchPluginKey = new PluginKey<SearchState>('search-plugin');
let searchStateChangeListener: ((state: SearchState) => void) | null = null;

type SearchAction =
	| { type: 'setQuery'; query: string }
	| { type: 'next' }
	| { type: 'prev' }
	| { type: 'clear' };

function collectTextSegments(doc: ProseMirrorNode): SearchTextSegment[] {
	const segments: SearchTextSegment[] = [];
	doc.descendants((node, pos) => {
		if (node.isText && node.text) {
			segments.push({ text: node.text, from: pos });
		}
	});
	return segments;
}

function buildMatches(doc: ProseMirrorNode, query: string) {
	return findMatchesInSegments(collectTextSegments(doc), query);
}

function applySearchAction(
	action: SearchAction,
	prev: SearchState,
	tr: Transaction,
): SearchState {
	switch (action.type) {
		case 'clear':
			return emptySearchState;
		case 'setQuery': {
			const matches = buildMatches(tr.doc, action.query);
			return setSearchQuery(action.query, matches);
		}
		case 'next':
			return moveToNextMatch(prev);
		case 'prev':
			return moveToPrevMatch(prev);
		default:
			return prev;
	}
}

function createDecorations(
	doc: ProseMirrorNode,
	state: SearchState,
): DecorationSet {
	if (!state.query || state.matches.length === 0) {
		return DecorationSet.empty;
	}
	const decorations = state.matches.map((m, index) => {
		const className =
			index === state.activeIndex
				? 'search-match search-match-active'
				: 'search-match';
		return Decoration.inline(m.from, m.to, {
			class: className,
		});
	});
	return DecorationSet.create(doc, decorations);
}

export const searchPlugin = $prose((_ctx: Ctx) => {
	return new Plugin<SearchState>({
		key: searchPluginKey,
		state: {
			init() {
				return emptySearchState;
			},
			apply(tr, prev) {
				const action = tr.getMeta(searchPluginKey) as SearchAction | undefined;
				if (action) {
					return applySearchAction(action, prev, tr);
				}

				if (tr.docChanged && prev.query) {
					const matches = buildMatches(tr.doc, prev.query);
					return clampActiveIndex({ ...prev, matches });
				}

				return prev;
			},
		},
		props: {
			decorations(state) {
				const current = searchPluginKey.getState(state) ?? emptySearchState;
				return createDecorations(state.doc, current);
			},
		},
		view(_view) {
			return {
				update(nextView: EditorView, prevState: EditorState) {
					const prev = searchPluginKey.getState(prevState) ?? emptySearchState;
					const current =
						searchPluginKey.getState(nextView.state) ?? emptySearchState;
					const changed =
						prev.query !== current.query ||
						prev.activeIndex !== current.activeIndex ||
						prev.matches.length !== current.matches.length;
					if (changed && searchStateChangeListener) {
						searchStateChangeListener(current);
					}
				},
				destroy() {},
			};
		},
	});
});

export function setSearchStateChangeListener(
	listener: ((state: SearchState) => void) | null,
): void {
	searchStateChangeListener = listener;
}

export function getSearchState(view: EditorView): SearchState {
	return searchPluginKey.getState(view.state) ?? emptySearchState;
}

export function setSearchQueryAction(view: EditorView, query: string): void {
	view.dispatch(
		view.state.tr.setMeta(searchPluginKey, { type: 'setQuery', query }),
	);
}

export function nextSearchMatchAction(view: EditorView): void {
	view.dispatch(view.state.tr.setMeta(searchPluginKey, { type: 'next' }));
}

export function prevSearchMatchAction(view: EditorView): void {
	view.dispatch(view.state.tr.setMeta(searchPluginKey, { type: 'prev' }));
}

export function clearSearchAction(view: EditorView): void {
	view.dispatch(view.state.tr.setMeta(searchPluginKey, { type: 'clear' }));
}
