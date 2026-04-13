import type { Editor } from '@milkdown/core';
import { editorViewCtx } from '@milkdown/core';
import { TextSelection } from '@milkdown/prose/state';
import type { ExportMode, RequestExportMessage } from '../protocol/messages';
import {
	clearSearchAction,
	getSearchState,
	nextSearchMatchAction,
	prevSearchMatchAction,
	setSearchQueryAction,
	setSearchStateChangeListener,
} from './searchPlugin';

export interface SearchPanelOptions {
	onEditorFocusOut: () => void;
	postMessage: (message: RequestExportMessage) => void;
}

export function mountSearchPanel(
	instance: Editor,
	options: SearchPanelOptions,
): () => void {
	let dispose: (() => void) | null = null;

	instance.action((ctx) => {
		const view = ctx.get(editorViewCtx);
		view.dom.addEventListener('focusout', options.onEditorFocusOut);
		const panel = document.createElement('div');
		panel.className = 'search-panel';
		panel.setAttribute('data-show', 'false');
		panel.setAttribute('data-replace', 'false');
		panel.setAttribute('data-export', 'false');
		panel.innerHTML = `
			<div class="search-row">
				<input class="search-input" type="text" placeholder="Find" />
				<span class="search-count">0/0</span>
				<button class="search-btn search-prev" title="Previous">↑</button>
				<button class="search-btn search-next" title="Next">↓</button>
				<button class="search-btn search-toggle-replace" title="Toggle Replace">↧</button>
				<button
					class="search-btn search-toggle-export"
					title="Export current view as styled HTML"
					aria-label="Export current view as styled HTML"
				>
					⤴
				</button>
				<button class="search-btn search-close" title="Close">✕</button>
			</div>
			<div class="replace-row">
				<input class="search-input replace-input" type="text" placeholder="Replace" />
				<button class="search-btn search-replace" title="Replace">Replace</button>
				<button class="search-btn search-replace-all" title="Replace All">All</button>
			</div>
			<div class="export-row">
				<span class="export-label">Export styled HTML</span>
				<div class="export-actions">
					<button
						class="search-btn search-export-clipboard"
						title="Copy styled HTML to clipboard"
						aria-label="Copy styled HTML to clipboard"
					>
						Copy
					</button>
					<button
						class="search-btn search-export-file"
						title="Export styled HTML file"
						aria-label="Export styled HTML file"
					>
						Export
					</button>
				</div>
			</div>
		`;
		document.body.appendChild(panel);

		const input = panel.querySelector('.search-input') as HTMLInputElement;
		const replaceInput = panel.querySelector(
			'.replace-input',
		) as HTMLInputElement;
		const count = panel.querySelector('.search-count') as HTMLSpanElement;
		const nextBtn = panel.querySelector('.search-next') as HTMLButtonElement;
		const prevBtn = panel.querySelector('.search-prev') as HTMLButtonElement;
		const toggleReplaceBtn = panel.querySelector(
			'.search-toggle-replace',
		) as HTMLButtonElement;
		const replaceBtn = panel.querySelector(
			'.search-replace',
		) as HTMLButtonElement;
		const replaceAllBtn = panel.querySelector(
			'.search-replace-all',
		) as HTMLButtonElement;
		const closeBtn = panel.querySelector('.search-close') as HTMLButtonElement;
		const exportToggleBtn = panel.querySelector(
			'.search-toggle-export',
		) as HTMLButtonElement;
		const exportClipboardBtn = panel.querySelector(
			'.search-export-clipboard',
		) as HTMLButtonElement;
		const exportFileBtn = panel.querySelector(
			'.search-export-file',
		) as HTMLButtonElement;

		function updateCount(): void {
			const state = getSearchState(view);
			const noResults = state.query.length > 0 && state.matches.length === 0;
			input.setAttribute('data-no-results', noResults ? 'true' : 'false');
			if (!state.query || state.matches.length === 0) {
				count.textContent = '0/0';
				return;
			}
			count.textContent = `${state.activeIndex + 1}/${state.matches.length}`;
		}

		function revealActiveMatch(): void {
			const state = getSearchState(view);
			if (state.activeIndex < 0 || state.activeIndex >= state.matches.length) {
				return;
			}
			const match = state.matches[state.activeIndex];
			const { from, to } = view.state.selection;
			if (from === match.from && to === match.to) {
				return;
			}
			view.dispatch(
				view.state.tr
					.setSelection(
						TextSelection.create(view.state.doc, match.from, match.to),
					)
					.scrollIntoView(),
			);
			requestAnimationFrame(() => {
				const dom = view.nodeDOM(match.from);
				if (dom instanceof HTMLElement) {
					dom.scrollIntoView({ block: 'center', behavior: 'smooth' });
					return;
				}
				if (dom instanceof Text && dom.parentElement) {
					dom.parentElement.scrollIntoView({
						block: 'center',
						behavior: 'smooth',
					});
				}
			});
		}

		function openSearchBar(): void {
			closeExportBar();
			panel.setAttribute('data-show', 'true');
			const selected = view.state.doc.textBetween(
				view.state.selection.from,
				view.state.selection.to,
				'\n',
			);
			if (selected.trim().length > 0) {
				input.value = selected;
				setSearchQueryAction(view, selected);
				revealActiveMatch();
				updateCount();
			} else {
				updateCount();
			}
			input.focus();
			input.select();
		}

		function openReplaceBar(): void {
			openSearchBar();
			panel.setAttribute('data-replace', 'true');
			replaceInput.focus();
			replaceInput.select();
		}

		function closeSearchBar(): void {
			panel.setAttribute('data-show', 'false');
			panel.setAttribute('data-replace', 'false');
			closeExportBar();
			input.value = '';
			replaceInput.value = '';
			clearSearchAction(view);
			updateCount();
			view.focus();
		}

		function toggleReplaceBar(): void {
			const showReplace = panel.getAttribute('data-replace') === 'true';
			panel.setAttribute('data-replace', showReplace ? 'false' : 'true');
			if (showReplace) {
				input.focus();
				return;
			}
			replaceInput.focus();
			replaceInput.select();
		}

		function closeExportBar(): void {
			panel.setAttribute('data-export', 'false');
		}

		function toggleExportBar(): void {
			const showExport = panel.getAttribute('data-export') === 'true';
			panel.setAttribute('data-export', showExport ? 'false' : 'true');
			if (!showExport) {
				exportClipboardBtn.focus();
			}
		}

		function sendExportRequest(mode: ExportMode): void {
			options.postMessage({ type: 'requestExport', mode });
			closeExportBar();
		}

		function onInputChange(): void {
			setSearchQueryAction(view, input.value);
			revealActiveMatch();
			updateCount();
		}

		function onNext(): void {
			nextSearchMatchAction(view);
			revealActiveMatch();
			updateCount();
		}

		function onPrev(): void {
			prevSearchMatchAction(view);
			revealActiveMatch();
			updateCount();
		}

		function onReplace(): void {
			const state = getSearchState(view);
			if (state.matches.length === 0) {
				return;
			}
			const activeIndex = Math.max(0, state.activeIndex);
			const match = state.matches[activeIndex];
			view.dispatch(
				view.state.tr.insertText(replaceInput.value, match.from, match.to),
			);
			revealActiveMatch();
			updateCount();
		}

		function onReplaceAll(): void {
			const state = getSearchState(view);
			if (state.matches.length === 0) {
				return;
			}
			let tr = view.state.tr;
			for (let i = state.matches.length - 1; i >= 0; i--) {
				const match = state.matches[i];
				tr = tr.insertText(replaceInput.value, match.from, match.to);
			}
			view.dispatch(tr);
			revealActiveMatch();
			updateCount();
		}

		function onKeyDown(event: KeyboardEvent): void {
			const key = event.key.toLowerCase();
			if ((event.metaKey || event.ctrlKey) && key === 'f') {
				event.preventDefault();
				openSearchBar();
				return;
			}
			if (event.key === 'F3') {
				event.preventDefault();
				if (event.shiftKey) {
					onPrev();
				} else {
					onNext();
				}
				return;
			}
			if (
				(event.metaKey || event.ctrlKey) &&
				key === 'g' &&
				panel.getAttribute('data-show') === 'true'
			) {
				event.preventDefault();
				if (event.shiftKey) {
					onPrev();
				} else {
					onNext();
				}
				return;
			}
			if ((event.metaKey || event.ctrlKey) && key === 'h') {
				event.preventDefault();
				if (panel.getAttribute('data-show') === 'true') {
					toggleReplaceBar();
				} else {
					openReplaceBar();
				}
				return;
			}
			if (
				event.key === 'Escape' &&
				panel.getAttribute('data-export') === 'true'
			) {
				event.preventDefault();
				closeExportBar();
				return;
			}
			if (
				event.key === 'Escape' &&
				panel.getAttribute('data-show') === 'true'
			) {
				event.preventDefault();
				closeSearchBar();
				return;
			}
		}

		input.addEventListener('input', onInputChange);
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				if (event.shiftKey) {
					onPrev();
				} else {
					onNext();
				}
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				closeSearchBar();
			}
		});
		nextBtn.addEventListener('click', onNext);
		prevBtn.addEventListener('click', onPrev);
		toggleReplaceBtn.addEventListener('click', toggleReplaceBar);
		replaceBtn.addEventListener('click', onReplace);
		replaceAllBtn.addEventListener('click', onReplaceAll);
		closeBtn.addEventListener('click', closeSearchBar);
		replaceInput.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				onReplace();
			}
			if (event.key === 'Escape') {
				event.preventDefault();
				closeSearchBar();
			}
		});
		exportToggleBtn.addEventListener('click', toggleExportBar);
		exportClipboardBtn.addEventListener('click', () =>
			sendExportRequest('clipboard'),
		);
		exportFileBtn.addEventListener('click', () => sendExportRequest('file'));
		window.addEventListener('keydown', onKeyDown);

		updateCount();
		setSearchStateChangeListener(() => {
			if (panel.getAttribute('data-show') === 'true') {
				updateCount();
			}
		});

		dispose = () => {
			window.removeEventListener('keydown', onKeyDown);
			view.dom.removeEventListener('focusout', options.onEditorFocusOut);
			setSearchStateChangeListener(null);
			panel.remove();
		};
	});

	return () => {
		dispose?.();
		dispose = null;
	};
}
