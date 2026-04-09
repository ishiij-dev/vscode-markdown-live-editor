export interface HeadingData {
	text: string;
	level: number;
	pos: number;
}

export interface WordCountData {
	words: number;
	characters: number;
}

// Strip spurious <br /> that can appear in serialized markdown table rows.
export function cleanupTableBr(md: string): string {
	return md
		.split('\n')
		.map((line) =>
			line.startsWith('|') ? line.replaceAll('<br />', '') : line,
		)
		.join('\n');
}

export function countText(text: string): WordCountData {
	const characters = text.length;
	const words = text.split(/\s+/).filter((w) => w.length > 0).length;
	return { words, characters };
}

export function headingsEqual(a: HeadingData[], b: HeadingData[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (
			a[i].text !== b[i].text ||
			a[i].level !== b[i].level ||
			a[i].pos !== b[i].pos
		) {
			return false;
		}
	}
	return true;
}

export function clampSelectionRange(
	from: number,
	to: number,
	maxPos: number,
): { from: number; to: number } {
	return {
		from: Math.max(0, Math.min(from, maxPos)),
		to: Math.max(0, Math.min(to, maxPos)),
	};
}
