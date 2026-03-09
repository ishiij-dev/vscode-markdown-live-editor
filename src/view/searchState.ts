export interface SearchTextSegment {
	text: string;
	from: number;
}

export interface SearchMatch {
	from: number;
	to: number;
}

export interface SearchState {
	query: string;
	matches: SearchMatch[];
	activeIndex: number;
}

export const emptySearchState: SearchState = {
	query: '',
	matches: [],
	activeIndex: -1,
};

export function findMatchesInSegments(
	segments: SearchTextSegment[],
	query: string,
): SearchMatch[] {
	if (!query) return [];

	const matches: SearchMatch[] = [];
	for (const segment of segments) {
		const text = segment.text.toLowerCase();
		const needle = query.toLowerCase();
		let index = text.indexOf(needle);
		while (index !== -1) {
			matches.push({
				from: segment.from + index,
				to: segment.from + index + query.length,
			});
			index = text.indexOf(needle, index + needle.length);
		}
	}
	return matches;
}

export function setSearchQuery(
	query: string,
	matches: SearchMatch[],
): SearchState {
	if (!query || matches.length === 0) {
		return {
			query,
			matches,
			activeIndex: -1,
		};
	}
	return {
		query,
		matches,
		activeIndex: 0,
	};
}

export function moveToNextMatch(state: SearchState): SearchState {
	if (state.matches.length === 0) return state;
	return {
		...state,
		activeIndex: (state.activeIndex + 1) % state.matches.length,
	};
}

export function moveToPrevMatch(state: SearchState): SearchState {
	if (state.matches.length === 0) return state;
	return {
		...state,
		activeIndex:
			(state.activeIndex - 1 + state.matches.length) % state.matches.length,
	};
}

export function clampActiveIndex(state: SearchState): SearchState {
	if (state.matches.length === 0) {
		return {
			...state,
			activeIndex: -1,
		};
	}
	if (state.activeIndex < 0 || state.activeIndex >= state.matches.length) {
		return {
			...state,
			activeIndex: 0,
		};
	}
	return state;
}
