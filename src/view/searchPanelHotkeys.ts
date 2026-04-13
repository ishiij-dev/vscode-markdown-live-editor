export type SearchPanelHotkeyAction =
	| 'openSearch'
	| 'next'
	| 'prev'
	| 'toggleReplaceOrOpen'
	| 'closeExport'
	| 'closeSearch';

export interface SearchPanelHotkeyHandlers {
	openSearch: () => void;
	next: () => void;
	prev: () => void;
	toggleReplaceOrOpen: () => void;
	closeExport: () => void;
	closeSearch: () => void;
}

export interface ResolveSearchPanelHotkeyInput {
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	shiftKey: boolean;
	isSearchOpen: boolean;
	isExportOpen: boolean;
}

export function resolveSearchPanelHotkey(
	input: ResolveSearchPanelHotkeyInput,
): SearchPanelHotkeyAction | null {
	const key = input.key.toLowerCase();
	const hasModifier = input.metaKey || input.ctrlKey;

	if (hasModifier && key === 'f') {
		return 'openSearch';
	}
	if (input.key === 'F3') {
		return input.shiftKey ? 'prev' : 'next';
	}
	if (hasModifier && key === 'g' && input.isSearchOpen) {
		return input.shiftKey ? 'prev' : 'next';
	}
	if (hasModifier && key === 'h') {
		return 'toggleReplaceOrOpen';
	}
	if (input.key === 'Escape' && input.isExportOpen) {
		return 'closeExport';
	}
	if (input.key === 'Escape' && input.isSearchOpen) {
		return 'closeSearch';
	}
	return null;
}

export function runSearchPanelHotkey(
	input: ResolveSearchPanelHotkeyInput,
	handlers: SearchPanelHotkeyHandlers,
): SearchPanelHotkeyAction | null {
	const action = resolveSearchPanelHotkey(input);
	if (!action) return null;
	if (action === 'openSearch') {
		handlers.openSearch();
		return action;
	}
	if (action === 'next') {
		handlers.next();
		return action;
	}
	if (action === 'prev') {
		handlers.prev();
		return action;
	}
	if (action === 'toggleReplaceOrOpen') {
		handlers.toggleReplaceOrOpen();
		return action;
	}
	if (action === 'closeExport') {
		handlers.closeExport();
		return action;
	}
	handlers.closeSearch();
	return action;
}
