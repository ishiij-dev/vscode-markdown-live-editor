export interface WebviewSyncState {
	pendingEchoContent: string | null;
}

export const initialWebviewSyncState: WebviewSyncState = {
	pendingEchoContent: null,
};

export function markPendingEcho(content: string): WebviewSyncState {
	return {
		pendingEchoContent: content,
	};
}

export function consumeDocumentChange(
	state: WebviewSyncState,
	currentText: string,
): { skip: boolean; next: WebviewSyncState } {
	if (
		state.pendingEchoContent !== null &&
		currentText === state.pendingEchoContent
	) {
		return {
			skip: true,
			next: initialWebviewSyncState,
		};
	}

	return {
		skip: false,
		next: state,
	};
}
