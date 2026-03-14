import {
	defaultValueCtx,
	Editor,
	editorStateCtx,
	editorViewCtx,
	parserCtx,
	rootCtx,
	serializerCtx,
} from '@milkdown/core';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import type { Node as ProseMirrorNode } from '@milkdown/prose/model';
import { Plugin, TextSelection } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';
import {
	type EditorToHostMessage,
	type ExportMode,
	type HostToEditorMessage,
	isHostToEditorMessage,
	type RequestExportHtmlMessage,
	type RequestExportMessage,
} from '../protocol/messages';
import { alertPlugin } from './alertPlugin';
import { autoPairPlugin } from './autoPairPlugin';
import { codeBlockPlugin, highlightPlugin } from './codeBlockPlugin';
import {
	cleanupTableBr,
	countText,
	type HeadingData,
	headingsEqual,
	type WordCountData,
} from './editorTestUtils';
import { emojiPlugin } from './emojiPlugin';
import {
	frontmatterSchema,
	frontmatterViewPlugin,
	remarkFrontmatterPlugin,
} from './frontmatterPlugin';
import { imageViewPlugin, setDocumentDirUri } from './imagePlugin';
import {
	mathDisplaySchema,
	mathInlineSchema,
	mathViewPlugin,
	remarkMathPlugin,
} from './katexPlugin';
import {
	clearSearchAction,
	getSearchState,
	nextSearchMatchAction,
	prevSearchMatchAction,
	searchPlugin,
	setSearchQueryAction,
	setSearchStateChangeListener,
} from './searchPlugin';
import { configureSlash, slash, slashKeyboardPlugin } from './slashPlugin';
import { configureTableBlock, tableBlock } from './tableBlockPlugin';
import {
	configureCustomLinkTooltip,
	configureSelectionToolbar,
	linkTooltipPlugin,
	selectionToolbar,
} from './toolbarPlugin';

declare function acquireVsCodeApi(): {
	postMessage(message: EditorToHostMessage): void;
	getState(): unknown;
	setState(state: unknown): void;
};

const vscode = acquireVsCodeApi();

// Global error handler — show errors visually in the webview
function showError(msg: string): void {
	console.error(`[view] ${msg}`);
	const el = document.createElement('pre');
	el.style.cssText =
		'color:#f44;background:#1e1e1e;padding:16px;margin:16px;border:2px solid #f44;font-size:13px;white-space:pre-wrap;';
	el.textContent = msg;
	document.body.prepend(el);
}
window.onerror = (_msg, _src, _line, _col, err) => {
	showError(`Uncaught: ${err?.stack || err || _msg}`);
};
window.addEventListener('unhandledrejection', (e) => {
	showError(`Unhandled rejection: ${e.reason?.stack || e.reason}`);
});

let editor: Editor | null = null;
let isUpdatingFromExtension = false;

// We compare against the normalized baseline to detect real user changes.
// This prevents the file from being dirtied just by opening it in the editor.
let normalizedBaseline = '';
let isInitializing = false;

// Debounce timer for sending updates to the extension host.
// Batches rapid keystrokes into a single postMessage call.
let updateTimer: ReturnType<typeof setTimeout> | null = null;
const UPDATE_DELAY_MS = 300;
let disposeSearchUi: (() => void) | null = null;

// ProseMirror plugin that detects doc changes and syncs to the extension host.
// Unlike Milkdown's markdownUpdated listener, this does NOT serialize the
// document on every keystroke. Serialization only happens when the debounce
// timer fires (after the user stops typing for UPDATE_DELAY_MS).
const syncPlugin = $prose((ctx) => {
	return new Plugin({
		view() {
			return {
				update(view, prevState) {
					if (isInitializing || isUpdatingFromExtension) return;
					if (view.state.doc.eq(prevState.doc)) return;

					if (updateTimer) clearTimeout(updateTimer);
					updateTimer = setTimeout(() => {
						updateTimer = null;
						const serializer = ctx.get(serializerCtx);
						const md = cleanupTableBr(serializer(view.state.doc));
						if (md === normalizedBaseline) return;
						vscode.postMessage({ type: 'update', body: md });
						normalizedBaseline = md;
					}, UPDATE_DELAY_MS);
				},
			};
		},
	});
});

// -------------------------------------------------------
// Heading extraction — sends headings to the extension host
// for the outline panel (TreeView).
// -------------------------------------------------------

function extractHeadings(doc: ProseMirrorNode): HeadingData[] {
	const headings: HeadingData[] = [];
	doc.descendants((node, pos) => {
		if (node.type.name === 'heading') {
			const text = node.textContent.trim();
			if (!text) return;
			headings.push({
				text,
				level: node.attrs.level as number,
				pos,
			});
		}
	});
	return headings;
}

let lastHeadings: HeadingData[] = [];

function sendHeadings(doc: ProseMirrorNode): void {
	const headings = extractHeadings(doc);
	if (headingsEqual(headings, lastHeadings)) return;
	lastHeadings = headings;
	vscode.postMessage({ type: 'headings', items: headings });
}

const headingExtractPlugin = $prose((_ctx) => {
	return new Plugin({
		view() {
			return {
				update(view, prevState) {
					if (isInitializing || isUpdatingFromExtension) return;
					if (view.state.doc.eq(prevState.doc)) return;
					sendHeadings(view.state.doc);
				},
			};
		},
	});
});

// -------------------------------------------------------
// Word count — sends word/character counts to the extension
// host for the status bar display.
// -------------------------------------------------------

function calculateWordCount(doc: ProseMirrorNode): WordCountData {
	let text = '';
	doc.descendants((node) => {
		if (node.isText) {
			text += node.text;
		} else if (node.isBlock && text.length > 0) {
			text += '\n';
		}
	});
	return countText(text);
}

let lastWordCount: WordCountData = { words: 0, characters: 0 };
let lastSelectionCount: WordCountData | null = null;

function sendWordCount(
	doc: ProseMirrorNode,
	selection?: { from: number; to: number },
): void {
	const total = calculateWordCount(doc);
	let sel: WordCountData | null = null;

	if (selection && selection.from !== selection.to) {
		const slice = doc.textBetween(selection.from, selection.to, '\n');
		sel = countText(slice);
	}

	if (
		total.words === lastWordCount.words &&
		total.characters === lastWordCount.characters &&
		sel?.words === lastSelectionCount?.words &&
		sel?.characters === lastSelectionCount?.characters
	) {
		return;
	}

	lastWordCount = total;
	lastSelectionCount = sel;
	vscode.postMessage({
		type: 'wordCount',
		words: total.words,
		characters: total.characters,
		selection: sel,
	});
}

const wordCountPlugin = $prose((_ctx) => {
	return new Plugin({
		view() {
			return {
				update(view, prevState) {
					if (isInitializing || isUpdatingFromExtension) return;
					const docChanged = !view.state.doc.eq(prevState.doc);
					const selChanged = !view.state.selection.eq(prevState.selection);
					if (!docChanged && !selChanged) return;
					const { from, to } = view.state.selection;
					sendWordCount(view.state.doc, { from, to });
				},
			};
		},
	});
});

function setupSearchUi(instance: Editor): void {
	if (disposeSearchUi) {
		disposeSearchUi();
		disposeSearchUi = null;
	}

	instance.action((ctx) => {
		const view = ctx.get(editorViewCtx);
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
					title="Export current view"
					aria-label="Export current view"
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
						title="Copy HTML to clipboard"
						aria-label="Copy HTML to clipboard"
					>
						Copy
					</button>
					<button
						class="search-btn search-export-file"
						title="Export HTML file"
						aria-label="Export HTML file"
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
			// Keep the active match around the center of the viewport for
			// smoother keyboard navigation across many results.
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
			const message: RequestExportMessage = {
				type: 'requestExport',
				mode,
			};
			vscode.postMessage(message);
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

		disposeSearchUi = () => {
			window.removeEventListener('keydown', onKeyDown);
			setSearchStateChangeListener(null);
			panel.remove();
		};
	});
}

async function createEditor(
	container: HTMLElement,
	markdown: string,
): Promise<Editor> {
	isInitializing = true;

	const instance = Editor.make()
		.config((ctx) => {
			ctx.set(rootCtx, container);
			ctx.set(defaultValueCtx, markdown);
		})
		.use(commonmark)
		.use(gfm)
		.use(tableBlock)
		.config(configureTableBlock)
		.use(remarkFrontmatterPlugin)
		.use(remarkMathPlugin)
		.use(frontmatterSchema)
		.use(mathInlineSchema)
		.use(mathDisplaySchema)
		.use(emojiPlugin)
		.use(syncPlugin)
		.use(headingExtractPlugin)
		.use(wordCountPlugin)
		.use(searchPlugin)
		.use(codeBlockPlugin)
		.use(autoPairPlugin)
		.use(highlightPlugin)
		.use(alertPlugin)
		.use(frontmatterViewPlugin)
		.use(mathViewPlugin)
		.use(imageViewPlugin)
		.use(selectionToolbar)
		.config(configureSelectionToolbar)
		.use(linkTooltipPlugin)
		.config(configureCustomLinkTooltip)
		.use(slash)
		.config(configureSlash)
		.use(slashKeyboardPlugin);

	await instance.create();

	// Capture the normalized baseline after editor is fully initialized
	instance.action((ctx) => {
		const serializer = ctx.get(serializerCtx);
		normalizedBaseline = cleanupTableBr(
			serializer(ctx.get(editorStateCtx).doc),
		);
	});
	setupSearchUi(instance);

	isInitializing = false;
	return instance;
}

function replaceContent(newMarkdown: string): void {
	if (!editor) {
		return;
	}
	isUpdatingFromExtension = true;
	try {
		editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			const serializer = ctx.get(serializerCtx);
			const currentMarkdown = cleanupTableBr(
				serializer(ctx.get(editorStateCtx).doc),
			);

			if (currentMarkdown === newMarkdown) {
				isUpdatingFromExtension = false;
				return;
			}

			const parser = ctx.get(parserCtx);
			const newDoc = parser(newMarkdown);
			const { tr } = view.state;
			tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
			view.dispatch(tr);

			// Update baseline to the new normalized content
			const updatedDoc = ctx.get(editorStateCtx).doc;
			normalizedBaseline = cleanupTableBr(serializer(updatedDoc));
			isUpdatingFromExtension = false;
			sendHeadings(updatedDoc);
			sendWordCount(updatedDoc);
		});
	} catch {
		isUpdatingFromExtension = false;
	}
}

function buildExportHtml(style: string, customStyle: string): string {
	const exportDoc = document.implementation.createHTMLDocument(
		'Markdown Live Editor Export',
	);
	const metaCharset = exportDoc.createElement('meta');
	metaCharset.setAttribute('charset', 'UTF-8');
	exportDoc.head.appendChild(metaCharset);

	const metaViewport = exportDoc.createElement('meta');
	metaViewport.name = 'viewport';
	metaViewport.content = 'width=device-width, initial-scale=1.0';
	exportDoc.head.appendChild(metaViewport);

	const titleElement = exportDoc.createElement('title');
	titleElement.textContent = 'Markdown Live Editor Export';
	exportDoc.head.appendChild(titleElement);

	if (style) {
		const styleElement = exportDoc.createElement('style');
		styleElement.textContent = style;
		exportDoc.head.appendChild(styleElement);
	}

	if (customStyle) {
		const customStyleElement = exportDoc.createElement('style');
		customStyleElement.textContent = customStyle;
		exportDoc.head.appendChild(customStyleElement);
	}

	const editorElement = document.getElementById('editor');
	const wrapper = exportDoc.createElement('div');
	wrapper.className = 'markdown-live-export';
	wrapper.innerHTML = editorElement?.innerHTML ?? '';
	sanitizeExportContainer(wrapper);
	exportDoc.body.appendChild(wrapper);

	return `<!DOCTYPE html>\n${exportDoc.documentElement.outerHTML}`;
}

function sanitizeExportContainer(root: HTMLElement): void {
	// Strip executable elements from exported snapshots.
	root
		.querySelectorAll(
			'script, iframe, object, embed, link[rel="import"], base, meta[http-equiv="refresh"]',
		)
		.forEach((node) => {
			node.remove();
		});

	root.querySelectorAll('*').forEach((element) => {
		for (const attribute of Array.from(element.attributes)) {
			const attrName = attribute.name.toLowerCase();
			const attrValue = attribute.value;

			if (attrName.startsWith('on')) {
				element.removeAttribute(attribute.name);
				continue;
			}

			if (attrName === 'srcdoc') {
				element.removeAttribute(attribute.name);
				continue;
			}

			if (isJavascriptUrlAttribute(attrName, attrValue)) {
				element.removeAttribute(attribute.name);
			}
		}
	});
}

function isJavascriptUrlAttribute(name: string, value: string): boolean {
	if (
		name !== 'href' &&
		name !== 'src' &&
		name !== 'xlink:href' &&
		name !== 'formaction'
	) {
		return false;
	}

	const normalized = value.toLowerCase().replace(/\s+/g, '');
	return normalized.startsWith('javascript:');
}

// Handle messages from the extension host
window.addEventListener('message', (event) => {
	const rawMessage = event.data;
	if (!isHostToEditorMessage(rawMessage)) {
		return;
	}
	const message: HostToEditorMessage = rawMessage;
	switch (message.type) {
		case 'init': {
			const container = document.getElementById('editor');
			if (!container) {
				return;
			}
			if (message.documentDirUri) {
				setDocumentDirUri(message.documentDirUri);
			}
			createEditor(container, message.body)
				.then((e) => {
					editor = e;
					e.action((ctx) => {
						const doc = ctx.get(editorStateCtx).doc;
						sendHeadings(doc);
						sendWordCount(doc);
					});
				})
				.catch((err) => {
					showError(`Editor init failed: ${err?.stack || err}`);
				});
			break;
		}
		case 'update': {
			replaceContent(message.body);
			break;
		}
		case 'scrollToHeading': {
			if (!editor) break;
			editor.action((ctx) => {
				const view = ctx.get(editorViewCtx);
				const { pos } = message;
				const { doc } = view.state;
				if (pos < 0 || pos >= doc.content.size) return;
				const selection = TextSelection.near(doc.resolve(pos));
				view.dispatch(view.state.tr.setSelection(selection));
				// Use DOM scrollIntoView to position the heading at the top
				const dom = view.nodeDOM(pos);
				if (dom instanceof HTMLElement) {
					dom.scrollIntoView({ block: 'start', behavior: 'smooth' });
				}
				view.focus();
			});
			break;
		}
		case 'requestHeadings': {
			if (!editor) break;
			editor.action((ctx) => {
				lastHeadings = [];
				sendHeadings(ctx.get(editorStateCtx).doc);
			});
			break;
		}
		case 'requestWordCount': {
			if (!editor) break;
			editor.action((ctx) => {
				lastWordCount = { words: 0, characters: 0 };
				lastSelectionCount = null;
				const state = ctx.get(editorStateCtx);
				const { from, to } = state.selection;
				sendWordCount(state.doc, { from, to });
			});
			break;
		}
		case 'requestExportHtml': {
			const request = message as RequestExportHtmlMessage;
			const html = buildExportHtml(request.style, request.customStyle);
			vscode.postMessage({
				type: 'exportHtml',
				html,
				mode: request.mode,
			});
			break;
		}
	}
});

// Notify the extension host that the webview is ready
vscode.postMessage({ type: 'ready' });
