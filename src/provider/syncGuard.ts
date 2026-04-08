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
		pendingEchoContent: normalizeEchoContent(content),
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

	if (normalizeEchoContent(currentText) === state.pendingEchoContent) {
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

function normalizeEchoContent(content: string): string {
	const normalizedEol = content.replace(/\r\n?/g, '\n');
	// Preserve semantic content while ignoring a single EOF newline difference.
	return normalizedEol.endsWith('\n')
		? normalizedEol.slice(0, normalizedEol.length - 1)
		: normalizedEol;
}
