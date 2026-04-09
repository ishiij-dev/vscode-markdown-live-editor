export interface WebviewSyncState {
	pendingEchoContent: string | null;
	pendingSetAtMs: number | null;
	pendingExpectedVersion: number | null;
}

export const initialWebviewSyncState: WebviewSyncState = {
	pendingEchoContent: null,
	pendingSetAtMs: null,
	pendingExpectedVersion: null,
};

// Pending echo state should be short-lived to avoid suppressing unrelated
// updates that happen much later but happen to match previous content.
export const PENDING_ECHO_TTL_MS = 5000;

export function markPendingEcho(
	content: string,
	expectedVersion: number,
	nowMs = Date.now(),
): WebviewSyncState {
	return {
		pendingEchoContent: normalizeEchoContent(content),
		pendingSetAtMs: nowMs,
		pendingExpectedVersion: expectedVersion,
	};
}

export function consumeDocumentChange(
	state: WebviewSyncState,
	currentText: string,
	currentVersion: number,
	nowMs = Date.now(),
): { skip: boolean; next: WebviewSyncState } {
	if (
		state.pendingEchoContent === null ||
		state.pendingSetAtMs === null ||
		state.pendingExpectedVersion === null
	) {
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

	// Prefer version-based skip: the next version after applyEdit should be the
	// echo-back change originating from the webview update we just applied.
	if (currentVersion === state.pendingExpectedVersion) {
		return {
			skip: true,
			next: initialWebviewSyncState,
		};
	}

	// Fallback for environments where version sequencing may differ subtly.
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
