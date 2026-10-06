export function createHistoryKeyBindings<T>(
	undo: T,
	redo: T,
): Record<string, T> {
	return {
		'Mod-z': undo,
		'Shift-Mod-z': redo,
		'Mod-y': redo,
	};
}

export function excludeFromUndoHistory<
	T extends { setMeta(key: string, value: unknown): T },
>(transaction: T): T {
	return transaction.setMeta('addToHistory', false);
}
