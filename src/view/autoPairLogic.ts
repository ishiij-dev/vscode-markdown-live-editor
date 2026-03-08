export const AUTO_PAIR_MAP: Record<string, string> = {
	'(': ')',
	'[': ']',
	'{': '}',
	'"': '"',
	"'": "'",
	'`': '`',
};

function isWordChar(ch: string): boolean {
	return /[0-9A-Za-z_]/.test(ch);
}

export function shouldAutoPairInput(params: {
	text: string;
	beforeChar: string;
	isComposing: boolean;
	isCodeContext: boolean;
}): boolean {
	const { text, beforeChar, isComposing, isCodeContext } = params;
	if (isComposing || isCodeContext) return false;
	if (text.length !== 1) return false;
	if (!(text in AUTO_PAIR_MAP)) return false;

	// Avoid apostrophe-style false positives: don't auto pair quotes/backticks
	// when typing right after a word char (e.g. don't -> d'on't).
	if (
		(text === "'" || text === '"' || text === '`') &&
		isWordChar(beforeChar)
	) {
		return false;
	}

	return true;
}
