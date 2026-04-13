import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveSearchPanelHotkey } from '../../src/view/searchPanelHotkeys';

describe('resolveSearchPanelHotkey', () => {
	it('opens search with Cmd/Ctrl+F', () => {
		assert.equal(
			resolveSearchPanelHotkey({
				key: 'f',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				isSearchOpen: false,
				isExportOpen: false,
			}),
			'openSearch',
		);
	});

	it('moves next/prev with F3 and Shift+F3', () => {
		assert.equal(
			resolveSearchPanelHotkey({
				key: 'F3',
				ctrlKey: false,
				metaKey: false,
				shiftKey: false,
				isSearchOpen: false,
				isExportOpen: false,
			}),
			'next',
		);
		assert.equal(
			resolveSearchPanelHotkey({
				key: 'F3',
				ctrlKey: false,
				metaKey: false,
				shiftKey: true,
				isSearchOpen: false,
				isExportOpen: false,
			}),
			'prev',
		);
	});

	it('moves next/prev with Cmd/Ctrl+G only when search is open', () => {
		assert.equal(
			resolveSearchPanelHotkey({
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				isSearchOpen: true,
				isExportOpen: false,
			}),
			'next',
		);
		assert.equal(
			resolveSearchPanelHotkey({
				key: 'g',
				ctrlKey: true,
				metaKey: false,
				shiftKey: false,
				isSearchOpen: false,
				isExportOpen: false,
			}),
			null,
		);
	});

	it('prioritizes export close over search close on Escape', () => {
		assert.equal(
			resolveSearchPanelHotkey({
				key: 'Escape',
				ctrlKey: false,
				metaKey: false,
				shiftKey: false,
				isSearchOpen: true,
				isExportOpen: true,
			}),
			'closeExport',
		);
	});
});
