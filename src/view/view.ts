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
	type HostToEditorMessage,
	isHostToEditorMessage,
	type RequestExportHtmlMessage,
} from '../protocol/messages';
import { hashText } from '../shared/hash';
import { alertPlugin } from './alertPlugin';
import { autoPairPlugin } from './autoPairPlugin';
import { changedBlockRange } from './blockDiffUtils';
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
import { headingFoldPlugin } from './headingFoldPlugin';
import { imageViewPlugin, setDocumentDirUri } from './imagePlugin';
import {
	mathDisplaySchema,
	mathInlineSchema,
	mathViewPlugin,
	remarkMathPlugin,
} from './katexPlugin';
import { decidePendingUpdate } from './pendingUpdateUtils';
import { mountSearchPanel } from './searchPanel';
import { searchPlugin } from './searchPlugin';
import { configureSlash, slash, slashKeyboardPlugin } from './slashPlugin';
import { configureTableBlock, tableBlock } from './tableBlockPlugin';
import {
	configureCustomLinkTooltip,
	configureSelectionToolbar,
	linkTooltipPlugin,
	selectionToolbar,
} from './toolbarPlugin';
import { createVisualLineNumbersController } from './visualLineNumbers';

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
let pendingRemoteMarkdown: string | null = null;
let syncDebugSeq = 0;

// We compare against the normalized baseline to detect real user changes.
// This prevents the file from being dirtied just by opening it in the editor.
let normalizedBaseline = '';
let isInitializing = false;

// Debounce timer for sending updates to the extension host.
// Batches rapid keystrokes into a single postMessage call.
let updateTimer: ReturnType<typeof setTimeout> | null = null;
const UPDATE_DELAY_MS = 300;

// Remote updates are deferred while the editor is focused so the caret is not
// disturbed mid-keystroke, but they must still land without waiting for a
// focusout: undo/redo is handled by VS Code (the webview has no history
// plugin), so it edits the TextDocument and comes back as a remote update
// while focus stays in the editor.
let pendingFlushTimer: ReturnType<typeof setTimeout> | null = null;
let lastLocalEditAt = 0;
let pendingQueuedAt = 0;
const PENDING_POLL_MS = 40;
let disposeSearchUi: (() => void) | null = null;
const SYNC_DEBUG_STORAGE_KEY = 'markdownLiveEditor.syncDebug';
let visualLineNumbersEnabled = false;
let syncDebugLogsEnabled = false;

function setSyncDebugLogsEnabled(enabled: boolean): void {
	syncDebugLogsEnabled = enabled;
	try {
		window.localStorage.setItem(SYNC_DEBUG_STORAGE_KEY, enabled ? '1' : '0');
	} catch {
		// Ignore localStorage failures in constrained webview environments.
	}
}

function isSyncDebugEnabled(): boolean {
	if (syncDebugLogsEnabled) return true;
	try {
		return window.localStorage.getItem(SYNC_DEBUG_STORAGE_KEY) === '1';
	} catch {
		return false;
	}
}

function syncDebug(event: string, payload: Record<string, unknown> = {}): void {
	if (!isSyncDebugEnabled()) return;
	syncDebugSeq += 1;
	const ts = Date.now();
	console.debug(`[MLE:view:${syncDebugSeq}] ${event}`, {
		ts,
		...payload,
	});
	vscode.postMessage({
		type: 'syncDebugLog',
		source: 'view',
		event,
		seq: syncDebugSeq,
		ts,
		payload,
	});
}

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

					lastLocalEditAt = Date.now();
					if (updateTimer) clearTimeout(updateTimer);
					updateTimer = setTimeout(() => {
						updateTimer = null;
						const serializer = ctx.get(serializerCtx);
						const md = cleanupTableBr(serializer(view.state.doc));
						if (md === normalizedBaseline) return;
						syncDebug('post-update', {
							length: md.length,
							hash: hashText(md),
							focus: view.hasFocus(),
							selectionFrom: view.state.selection.from,
							selectionTo: view.state.selection.to,
						});
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

const visualLineNumbersController = createVisualLineNumbersController({
	isUpdateBlocked: () => isInitializing || isUpdatingFromExtension,
});

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
		.use(visualLineNumbersController.plugin)
		.use(searchPlugin)
		.use(headingFoldPlugin)
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
	if (disposeSearchUi) {
		disposeSearchUi();
		disposeSearchUi = null;
	}
	disposeSearchUi = mountSearchPanel(instance, {
		onEditorFocusOut: () => {
			setTimeout(maybeApplyPendingRemoteUpdate, 0);
		},
		postMessage: (message) => {
			vscode.postMessage(message);
		},
	});
	visualLineNumbersController.updateEnabled(visualLineNumbersEnabled);

	isInitializing = false;
	return instance;
}

function topLevelBlocks(doc: ProseMirrorNode): ProseMirrorNode[] {
	const blocks: ProseMirrorNode[] = [];
	doc.content.forEach((child) => {
		blocks.push(child);
	});
	return blocks;
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
				syncDebug('replace-skip-equal', {
					incomingLength: newMarkdown.length,
					incomingHash: hashText(newMarkdown),
				});
				isUpdatingFromExtension = false;
				return;
			}

			const parser = ctx.get(parserCtx);
			const newDoc = parser(newMarkdown);
			// Replace only the top-level blocks that differ. Replacing the whole
			// document maps the selection into a range that no longer exists and
			// pushes the caret to the end of the replacement, which is visible on
			// every undo and every external edit to the file.
			const range = changedBlockRange(
				topLevelBlocks(view.state.doc),
				topLevelBlocks(newDoc),
			);
			syncDebug('replace-apply', {
				incomingLength: newMarkdown.length,
				incomingHash: hashText(newMarkdown),
				currentLength: currentMarkdown.length,
				currentHash: hashText(currentMarkdown),
				focus: view.hasFocus(),
				selectionFrom: view.state.selection.from,
				selectionTo: view.state.selection.to,
				replacedFrom: range.from,
				replacedTo: range.to,
			});
			const { tr } = view.state;
			tr.replaceWith(
				range.from,
				range.to,
				newDoc.content.cut(range.newFrom, range.newTo),
			);
			view.dispatch(tr);

			// Safety net: a narrowed replacement must reproduce the incoming
			// document exactly. If it does not, fall back to replacing everything
			// so content is never left in a wrong state.
			if (!view.state.doc.eq(newDoc)) {
				syncDebug('replace-fallback-full', {
					incomingHash: hashText(newMarkdown),
				});
				const fallbackTr = view.state.tr;
				fallbackTr.replaceWith(0, view.state.doc.content.size, newDoc.content);
				view.dispatch(fallbackTr);
			}

			// Update baseline to the new normalized content
			const updatedDoc = ctx.get(editorStateCtx).doc;
			normalizedBaseline = cleanupTableBr(serializer(updatedDoc));
			isUpdatingFromExtension = false;
			sendHeadings(updatedDoc);
			sendWordCount(updatedDoc);
			visualLineNumbersController.updateEnabled(visualLineNumbersEnabled);
		});
	} catch {
		isUpdatingFromExtension = false;
	}
}

function isEditorViewFocused(): boolean {
	if (!editor) return false;
	// ProseMirror's hasFocus() compares against root.activeElement, which stays
	// set after the webview iframe loses focus. Without this check the editor
	// keeps reporting focus once it has been clicked, so every remote update is
	// queued and only a later focusout can flush it.
	if (typeof document.hasFocus === 'function' && !document.hasFocus()) {
		return false;
	}
	let focused = false;
	try {
		editor.action((ctx) => {
			const view = ctx.get(editorViewCtx);
			focused = view.hasFocus();
		});
	} catch {
		return false;
	}
	return focused;
}

function maybeApplyPendingRemoteUpdate(): void {
	if (!pendingRemoteMarkdown) return;
	if (isEditorViewFocused()) {
		syncDebug('pending-defer-focused', {
			length: pendingRemoteMarkdown.length,
			hash: hashText(pendingRemoteMarkdown),
		});
		return;
	}
	const queued = pendingRemoteMarkdown;
	pendingRemoteMarkdown = null;
	syncDebug('pending-apply', { length: queued.length, hash: hashText(queued) });
	replaceContent(queued);
}

// Applies a queued remote update as soon as it is safe to do so, so undo/redo
// and external file edits land while the editor keeps focus.
function schedulePendingFlush(): void {
	if (pendingFlushTimer) clearTimeout(pendingFlushTimer);
	pendingFlushTimer = setTimeout(() => {
		pendingFlushTimer = null;
		if (!pendingRemoteMarkdown) return;

		// updateTimer is non-null exactly while local edits have not reached the
		// host yet, so it answers "is the snapshot missing local edits?" without
		// guessing at a quiet period with a fixed delay.
		const decision = decidePendingUpdate({
			queuedAt: pendingQueuedAt,
			lastLocalEditAt,
			hasUnsyncedLocalEdits: updateTimer !== null,
		});

		if (decision === 'discard') {
			syncDebug('pending-discard-stale', {
				length: pendingRemoteMarkdown.length,
				hash: hashText(pendingRemoteMarkdown),
			});
			pendingRemoteMarkdown = null;
			return;
		}

		if (decision === 'wait') {
			schedulePendingFlush();
			return;
		}

		const queued = pendingRemoteMarkdown;
		pendingRemoteMarkdown = null;
		syncDebug('pending-apply-idle', {
			length: queued.length,
			hash: hashText(queued),
		});
		replaceContent(queued);
	}, PENDING_POLL_MS);
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
			setSyncDebugLogsEnabled(message.syncDebugLogs);
			visualLineNumbersEnabled = message.visualLineNumbers;
			visualLineNumbersController.updateEnabled(visualLineNumbersEnabled);
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
			syncDebug('host-update-received', {
				length: message.body.length,
				hash: hashText(message.body),
				focus: isEditorViewFocused(),
			});
			if (isEditorViewFocused()) {
				pendingRemoteMarkdown = message.body;
				pendingQueuedAt = Date.now();
				syncDebug('host-update-queued', {
					length: message.body.length,
					hash: hashText(message.body),
				});
				schedulePendingFlush();
				break;
			}
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
		case 'setSyncDebugLogs': {
			setSyncDebugLogsEnabled(message.enabled);
			break;
		}
	}
});

window.addEventListener('blur', () => {
	setTimeout(maybeApplyPendingRemoteUpdate, 0);
});

// Notify the extension host that the webview is ready
vscode.postMessage({ type: 'ready' });
