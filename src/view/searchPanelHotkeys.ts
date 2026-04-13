export type SearchPanelHotkeyAction =
	| 'openSearch'
	| 'next'
	| 'prev'
	| 'toggleReplaceOrOpen'
	| 'closeExport'
	| 'closeSearch';

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
