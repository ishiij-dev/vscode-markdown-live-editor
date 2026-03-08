export interface WebviewSyncState {
	pendingEchoContent: string | null;
	pendingSetAtMs: number | null;
}

export const initialWebviewSyncState: WebviewSyncState = {
	pendingEchoContent: null,
	pendingSetAtMs: null,
};

// Pending echo state should be short-lived to avoid suppressing unrelated
// updates that happen much later but happen to match previous content.
export const PENDING_ECHO_TTL_MS = 1000;

export function markPendingEcho(
	content: string,
	nowMs = Date.now(),
): WebviewSyncState {
	return {
		pendingEchoContent: content,
		pendingSetAtMs: nowMs,
	};
}

export function consumeDocumentChange(
	state: WebviewSyncState,
	currentText: string,
	nowMs = Date.now(),
): { skip: boolean; next: WebviewSyncState } {
	if (state.pendingEchoContent === null || state.pendingSetAtMs === null) {
		return {
			skip: false,
			next: initialWebviewSyncState,
		};
	}

	if (nowMs - state.pendingSetAtMs > PENDING_ECHO_TTL_MS) {
		return {
			skip: false,
			next: initialWebviewSyncState,
		};
	}

	if (currentText === state.pendingEchoContent) {
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
