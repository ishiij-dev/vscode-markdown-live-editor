export interface HeadingItem {
	text: string;
	level: number;
	pos: number;
}

export interface WordCountValue {
	words: number;
	characters: number;
}

export interface ReadyMessage {
	type: 'ready';
}

export interface UpdateMessage {
	type: 'update';
	body: string;
}

export interface InitMessage {
	type: 'init';
	body: string;
	documentDirUri: string;
}

export interface ScrollToHeadingMessage {
	type: 'scrollToHeading';
	pos: number;
}

export interface RequestHeadingsMessage {
	type: 'requestHeadings';
}

export interface RequestWordCountMessage {
	type: 'requestWordCount';
}

export interface HeadingsMessage {
	type: 'headings';
	items: HeadingItem[];
}

export interface WordCountMessage {
	type: 'wordCount';
	words: number;
	characters: number;
	selection: WordCountValue | null;
}

export type ExportMode = 'clipboard' | 'file';

export interface RequestExportHtmlMessage {
	type: 'requestExportHtml';
	mode: ExportMode;
	style: string;
	customStyle: string;
}

export interface ExportHtmlMessage {
	type: 'exportHtml';
	html: string;
	mode: ExportMode;
}

export interface RequestExportMessage {
	type: 'requestExport';
	mode: ExportMode;
}

export type HostToEditorMessage =
	| InitMessage
	| RequestHeadingsMessage
	| RequestWordCountMessage
	| ScrollToHeadingMessage
	| UpdateMessage
	| RequestExportHtmlMessage;

export type EditorToHostMessage =
	| HeadingsMessage
	| ReadyMessage
	| UpdateMessage
	| WordCountMessage
	| ExportHtmlMessage
	| RequestExportMessage;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isHeadingItem(value: unknown): value is HeadingItem {
	if (!isRecord(value)) return false;
	return (
		typeof value.text === 'string' &&
		typeof value.level === 'number' &&
		typeof value.pos === 'number'
	);
}

function isWordCountValue(value: unknown): value is WordCountValue {
	if (!isRecord(value)) return false;
	return (
		typeof value.words === 'number' && typeof value.characters === 'number'
	);
}

export function isHostToEditorMessage(
	value: unknown,
): value is HostToEditorMessage {
	if (!isRecord(value) || typeof value.type !== 'string') return false;
	switch (value.type) {
		case 'init':
			return (
				typeof value.body === 'string' &&
				typeof value.documentDirUri === 'string'
			);
		case 'update':
			return typeof value.body === 'string';
		case 'scrollToHeading':
			return typeof value.pos === 'number';
		case 'requestHeadings':
		case 'requestWordCount':
			return true;
		case 'requestExportHtml':
			return (
				typeof value.mode === 'string' &&
				(value.mode === 'clipboard' || value.mode === 'file') &&
				typeof value.style === 'string' &&
				typeof value.customStyle === 'string'
			);
		default:
			return false;
	}
}

export function isEditorToHostMessage(
	value: unknown,
): value is EditorToHostMessage {
	if (!isRecord(value) || typeof value.type !== 'string') return false;
	switch (value.type) {
		case 'ready':
			return true;
		case 'update':
			return typeof value.body === 'string';
		case 'headings':
			return Array.isArray(value.items) && value.items.every(isHeadingItem);
		case 'wordCount':
			return (
				typeof value.words === 'number' &&
				typeof value.characters === 'number' &&
				(value.selection === null || isWordCountValue(value.selection))
			);
		case 'exportHtml':
			return (
				typeof value.html === 'string' &&
				typeof value.mode === 'string' &&
				(value.mode === 'clipboard' || value.mode === 'file')
			);
		case 'requestExport':
			return (
				typeof value.mode === 'string' &&
				(value.mode === 'clipboard' || value.mode === 'file')
			);
		default:
			return false;
	}
}
