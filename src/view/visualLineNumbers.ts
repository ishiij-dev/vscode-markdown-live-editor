import { Plugin } from '@milkdown/prose/state';
import { $prose } from '@milkdown/utils';
import {
	countLogicalTextLines,
	countParagraphRowsFromHardBreaks,
	dedupeNearbyRowTops,
	shouldMergeNearbyTop,
} from './editorTestUtils';

interface VisualLineNumbersControllerOptions {
	isUpdateBlocked: () => boolean;
}

export interface VisualLineNumbersController {
	plugin: ReturnType<typeof $prose>;
	updateEnabled: (enabled: boolean) => void;
}

export function createVisualLineNumbersController(
	options: VisualLineNumbersControllerOptions,
): VisualLineNumbersController {
	let visualLineNumbersEnabled = false;
	let visualLineGutter: HTMLDivElement | null = null;
	let visualLineRenderQueued = false;

	function ensureVisualLineGutter(): HTMLDivElement {
		if (visualLineGutter) {
			return visualLineGutter;
		}
		const gutter = document.createElement('div');
		gutter.className = 'visual-line-gutter';
		gutter.setAttribute('data-show', 'false');
		document.body.appendChild(gutter);
		visualLineGutter = gutter;
		return gutter;
	}

	function hideVisualLineNumbers(): void {
		document.body.setAttribute('data-visual-line-numbers', 'false');
		if (!visualLineGutter) return;
		visualLineGutter.setAttribute('data-show', 'false');
	}

	function isLogicalLineBlock(element: HTMLElement): boolean {
		if (element.classList.contains('heading-fold-hidden')) return false;
		if (element.tagName === 'HR') return false;
		if (element.tagName === 'P') {
			return element.textContent?.trim().length !== 0;
		}
		return true;
	}

	function collectListLineItems(list: HTMLElement): HTMLElement[] {
		const rows: HTMLElement[] = [];
		for (const child of Array.from(list.children)) {
			if (!(child instanceof HTMLElement)) continue;
			if (child.tagName !== 'LI') continue;
			if (!child.classList.contains('heading-fold-hidden')) {
				rows.push(child);
			}
			for (const nested of Array.from(child.children)) {
				if (!(nested instanceof HTMLElement)) continue;
				if (nested.tagName === 'UL' || nested.tagName === 'OL') {
					rows.push(...collectListLineItems(nested));
				}
			}
		}
		return rows;
	}

	function collectTableLineItems(table: HTMLElement): HTMLElement[] {
		const htmlTable = table as HTMLTableElement;
		const rowsFromApi = Array.from(htmlTable.rows).filter(
			(row): row is HTMLTableRowElement => row instanceof HTMLTableRowElement,
		);
		if (rowsFromApi.length > 0) {
			return rowsFromApi.filter(
				(row) => !row.classList.contains('heading-fold-hidden'),
			);
		}
		return Array.from(table.querySelectorAll('tr')).filter(
			(row): row is HTMLTableRowElement =>
				row instanceof HTMLTableRowElement &&
				!row.classList.contains('heading-fold-hidden'),
		);
	}

	function findRenderableTable(container: HTMLElement): HTMLElement | null {
		const preferred = container.querySelector('table.children');
		if (preferred instanceof HTMLElement) {
			return preferred;
		}

		const tables = Array.from(container.querySelectorAll('table')).filter(
			(table): table is HTMLTableElement => table instanceof HTMLTableElement,
		);
		if (tables.length === 0) {
			return null;
		}

		return tables.reduce((best, current) =>
			current.rows.length > best.rows.length ? current : best,
		);
	}

	function collectLogicalLineBlocks(container: HTMLElement): HTMLElement[] {
		const blocks: HTMLElement[] = [];
		for (const child of Array.from(container.children)) {
			if (!(child instanceof HTMLElement)) continue;
			if (child.classList.contains('heading-fold-hidden')) continue;

			if (child.tagName === 'UL' || child.tagName === 'OL') {
				blocks.push(...collectListLineItems(child));
				continue;
			}
			if (child.tagName === 'TABLE') {
				blocks.push(...collectTableLineItems(child));
				continue;
			}
			const nestedTable = findRenderableTable(child);
			if (nestedTable instanceof HTMLElement) {
				blocks.push(...collectTableLineItems(nestedTable));
				continue;
			}
			if (child.tagName === 'BLOCKQUOTE') {
				blocks.push(...collectLogicalLineBlocks(child));
				continue;
			}
			blocks.push(child);
		}
		return blocks.filter(isLogicalLineBlock);
	}

	function collectCodeBlockVisualRows(
		block: HTMLElement,
		proseTop: number,
	): number[] {
		const code = block.querySelector('code');
		if (!(code instanceof HTMLElement)) {
			const rect = block.getBoundingClientRect();
			return [rect.top - proseTop];
		}

		const range = document.createRange();
		const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
		const tops: number[] = [];

		let current = walker.nextNode();
		while (current) {
			if (
				current instanceof Text &&
				current.nodeValue &&
				current.nodeValue.length > 0
			) {
				range.selectNodeContents(current);
				const rects = Array.from(range.getClientRects());
				for (const rect of rects) {
					if (rect.height < 1) continue;
					tops.push(rect.top - proseTop);
				}
			}
			current = walker.nextNode();
		}

		if (tops.length === 0) {
			const rect = block.getBoundingClientRect();
			return [rect.top - proseTop];
		}

		return dedupeNearbyRowTops(tops, 1.5);
	}

	function collectParagraphVisualRows(
		block: HTMLElement,
		proseTop: number,
	): number[] {
		const rect = block.getBoundingClientRect();
		const style = window.getComputedStyle(block);
		const lineHeightPx = Number.parseFloat(style.lineHeight);
		const lineHeight = Number.isFinite(lineHeightPx) ? lineHeightPx : 22;
		const hardBreakCount = block.querySelectorAll('br').length;
		const lineCount = countParagraphRowsFromHardBreaks(hardBreakCount);

		const rows: number[] = [];
		for (let i = 0; i < lineCount; i += 1) {
			rows.push(rect.top - proseTop + i * lineHeight);
		}
		return rows;
	}

	function collectVisualRowsForBlock(
		block: HTMLElement,
		proseTop: number,
	): number[] {
		if (block.classList.contains('frontmatter-block')) {
			const header = block.querySelector('.frontmatter-header');
			const textarea = block.querySelector(
				'textarea.frontmatter-content',
			) as HTMLTextAreaElement | null;
			const blockRows: number[] = [];

			if (header instanceof HTMLElement) {
				const headerRect = header.getBoundingClientRect();
				blockRows.push(headerRect.top - proseTop);
			}

			if (textarea?.classList.contains('frontmatter-content--visible')) {
				const textRect = textarea.getBoundingClientRect();
				const style = window.getComputedStyle(textarea);
				const lineHeightPx = Number.parseFloat(style.lineHeight);
				const lineHeight = Number.isFinite(lineHeightPx) ? lineHeightPx : 20;
				const lineCount = countLogicalTextLines(textarea.value);
				for (let i = 0; i < lineCount; i += 1) {
					blockRows.push(textRect.top - proseTop + i * lineHeight);
				}
			}

			if (blockRows.length > 0) {
				return blockRows;
			}
		}

		if (block.tagName === 'PRE') {
			return collectCodeBlockVisualRows(block, proseTop);
		}
		if (block.tagName === 'P') {
			return collectParagraphVisualRows(block, proseTop);
		}
		const rect = block.getBoundingClientRect();
		return [rect.top - proseTop];
	}

	function renderVisualLineNumbers(): void {
		visualLineRenderQueued = false;
		if (!visualLineNumbersEnabled) {
			hideVisualLineNumbers();
			return;
		}

		const prose = document.querySelector<HTMLElement>('.ProseMirror');
		if (!prose) {
			hideVisualLineNumbers();
			return;
		}

		const proseRect = prose.getBoundingClientRect();
		const visibleTop = Math.max(0, proseRect.top);
		const visibleBottom = Math.min(window.innerHeight, proseRect.bottom);
		const visibleHeight = Math.max(0, visibleBottom - visibleTop);
		if (visibleHeight < 4) {
			hideVisualLineNumbers();
			return;
		}

		const blocks = collectLogicalLineBlocks(prose);

		const gutter = ensureVisualLineGutter();
		gutter.style.top = `${visibleTop}px`;
		gutter.style.height = `${visibleHeight}px`;
		gutter.style.left = `${Math.max(4, proseRect.left - 46)}px`;

		const fragment = document.createDocumentFragment();
		let visualLineNumber = 1;
		let lastCountedTop = Number.NEGATIVE_INFINITY;
		for (const block of blocks) {
			const rect = block.getBoundingClientRect();
			if (rect.height < 1) continue;
			const rows = collectVisualRowsForBlock(block, proseRect.top);
			for (const y of rows) {
				const absoluteTop = proseRect.top + y;
				if (shouldMergeNearbyTop(absoluteTop, lastCountedTop, 4)) {
					continue;
				}
				lastCountedTop = absoluteTop;
				if (
					absoluteTop + 2 >= visibleTop - 2 &&
					absoluteTop - 2 <= visibleBottom + 2
				) {
					const row = document.createElement('div');
					row.className = 'visual-line-number visual-line-number-primary';
					row.style.top = `${Math.round(absoluteTop - visibleTop)}px`;
					row.textContent = `${visualLineNumber}`;
					fragment.appendChild(row);
				}
				visualLineNumber += 1;
			}
		}

		gutter.textContent = '';
		gutter.appendChild(fragment);
		gutter.setAttribute('data-show', 'true');
		document.body.setAttribute('data-visual-line-numbers', 'true');
	}

	function scheduleVisualLineNumbersRender(): void {
		if (visualLineRenderQueued) return;
		visualLineRenderQueued = true;
		requestAnimationFrame(renderVisualLineNumbers);
	}

	function updateEnabled(enabled: boolean): void {
		visualLineNumbersEnabled = enabled;
		if (!enabled) {
			hideVisualLineNumbers();
			return;
		}
		scheduleVisualLineNumbersRender();
	}

	const plugin = $prose((_ctx) => {
		return new Plugin({
			view() {
				const onViewportChange = () => {
					if (!visualLineNumbersEnabled) return;
					scheduleVisualLineNumbersRender();
				};
				window.addEventListener('scroll', onViewportChange, { passive: true });
				window.addEventListener('resize', onViewportChange);
				return {
					update(view, prevState) {
						if (options.isUpdateBlocked()) return;
						const docChanged = !view.state.doc.eq(prevState.doc);
						const selChanged = !view.state.selection.eq(prevState.selection);
						if (!docChanged && !selChanged) return;
						if (!visualLineNumbersEnabled) return;
						scheduleVisualLineNumbersRender();
					},
					destroy() {
						window.removeEventListener('scroll', onViewportChange);
						window.removeEventListener('resize', onViewportChange);
						hideVisualLineNumbers();
					},
				};
			},
		});
	});

	return {
		plugin,
		updateEnabled,
	};
}
