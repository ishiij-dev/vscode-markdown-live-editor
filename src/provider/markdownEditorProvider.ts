import * as vscode from 'vscode';
import {
	type ExportHtmlMessage,
	type ExportMode,
	type HostToEditorMessage,
	isEditorToHostMessage,
	type RequestExportMessage,
} from '../protocol/messages';
import type { OutlineProvider } from './outlineProvider';
import {
	consumeDocumentChange,
	initialWebviewSyncState,
	markPendingEcho,
	type WebviewSyncState,
} from './syncGuard';

export class MarkdownEditorProvider implements vscode.CustomTextEditorProvider {
	public static readonly viewType = 'markdownLiveEditor.editor';

	private activeWebviewPanel: vscode.WebviewPanel | null = null;
	private readonly styleUri: vscode.Uri;
	private styleCache: string | null = null;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly outlineProvider: OutlineProvider,
		private readonly wordCountStatusBar: vscode.StatusBarItem,
	) {
		this.styleUri = vscode.Uri.joinPath(
			context.extensionUri,
			'media',
			'style.css',
		);
	}

	public static register(
		context: vscode.ExtensionContext,
		outlineProvider: OutlineProvider,
		wordCountStatusBar: vscode.StatusBarItem,
	): vscode.Disposable {
		const provider = new MarkdownEditorProvider(
			context,
			outlineProvider,
			wordCountStatusBar,
		);

		const disposables: vscode.Disposable[] = [];

		disposables.push(
			vscode.window.registerCustomEditorProvider(
				MarkdownEditorProvider.viewType,
				provider,
				{
					webviewOptions: { retainContextWhenHidden: true },
				},
			),
		);

		disposables.push(
			vscode.commands.registerCommand('markdownLiveEditor.exportHtml', () =>
				provider.showExportOptions(),
			),
		);

		disposables.push(
			vscode.commands.registerCommand(
				'markdownLiveEditor.scrollToHeading',
				(pos: number) => {
					const message: HostToEditorMessage = {
						type: 'scrollToHeading',
						pos,
					};
					provider.activeWebviewPanel?.webview.postMessage(message);
				},
			),
		);

		return vscode.Disposable.from(...disposables);
	}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		const documentDir = vscode.Uri.joinPath(document.uri, '..');
		const workspaceFolder = vscode.workspace.getWorkspaceFolder(
			document.uri,
		)?.uri;
		const localResourceRoots = [this.context.extensionUri, documentDir];
		if (workspaceFolder) {
			localResourceRoots.push(workspaceFolder);
		}
		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots,
		};

		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		// Track active panel for outline and scroll commands
		this.activeWebviewPanel = webviewPanel;
		vscode.commands.executeCommand(
			'setContext',
			'markdownLiveEditor.outlineAvailable',
			true,
		);

		// Prevent one echo-back round-trip for edits originating from webview.
		// The state is consumed on the next matching document change.
		let syncState: WebviewSyncState = initialWebviewSyncState;

		// Handle all messages from the webview in a single listener
		const onDidReceiveMessage = webviewPanel.webview.onDidReceiveMessage(
			async (message: unknown) => {
				if (!isEditorToHostMessage(message)) {
					return;
				}
				switch (message.type) {
					case 'ready': {
						const documentDirUri = webviewPanel.webview
							.asWebviewUri(documentDir)
							.toString();
						const initMessage: HostToEditorMessage = {
							type: 'init',
							body: document.getText(),
							documentDirUri,
						};
						webviewPanel.webview.postMessage(initMessage);
						break;
					}
					case 'update': {
						const text = message.body;
						if (text === document.getText()) {
							return;
						}
						syncState = markPendingEcho(text);
						const edit = new vscode.WorkspaceEdit();
						edit.replace(
							document.uri,
							new vscode.Range(0, 0, document.lineCount, 0),
							text,
						);
						vscode.workspace.applyEdit(edit);
						break;
					}
					case 'headings': {
						if (this.activeWebviewPanel === webviewPanel) {
							this.outlineProvider.updateHeadings(message.items);
						}
						break;
					}
					case 'wordCount': {
						if (this.activeWebviewPanel === webviewPanel) {
							const w = message.words;
							const c = message.characters;
							const sel = message.selection;
							this.wordCountStatusBar.text = sel
								? `Words: ${sel.words}/${w} | Chars: ${sel.characters}/${c}`
								: `Words: ${w} | Chars: ${c}`;
							this.wordCountStatusBar.show();
						}
						break;
					}
					case 'requestExport': {
						const request = message as RequestExportMessage;
						const style = await this.getStyleSheet();
						const customStyle = this.getCustomStyle();
						this.postExportRequest(request.mode, style, customStyle);
						break;
					}
					case 'exportHtml': {
						if (this.activeWebviewPanel === webviewPanel) {
							void this.handleExportHtml(message);
						}
						break;
					}
				}
			},
		);

		// Sync external changes (e.g. from text editor) to webview.
		// Skip one matching echo-back change after applying webview updates.
		const onDidChangeTextDocument = vscode.workspace.onDidChangeTextDocument(
			(e) => {
				if (e.document.uri.toString() !== document.uri.toString()) {
					return;
				}
				const currentText = document.getText();
				const { skip, next } = consumeDocumentChange(syncState, currentText);
				syncState = next;
				if (skip) {
					return;
				}
				const updateMessage: HostToEditorMessage = {
					type: 'update',
					body: currentText,
				};
				webviewPanel.webview.postMessage(updateMessage);
			},
		);

		// Track focus changes across multiple editor tabs
		const onDidChangeViewState = webviewPanel.onDidChangeViewState((e) => {
			if (e.webviewPanel.active) {
				this.activeWebviewPanel = webviewPanel;
				vscode.commands.executeCommand(
					'setContext',
					'markdownLiveEditor.outlineAvailable',
					true,
				);
				const requestHeadingsMessage: HostToEditorMessage = {
					type: 'requestHeadings',
				};
				const requestWordCountMessage: HostToEditorMessage = {
					type: 'requestWordCount',
				};
				webviewPanel.webview.postMessage(requestHeadingsMessage);
				webviewPanel.webview.postMessage(requestWordCountMessage);
			} else if (this.activeWebviewPanel === webviewPanel) {
				this.wordCountStatusBar.hide();
			}
		});

		webviewPanel.onDidDispose(() => {
			onDidReceiveMessage.dispose();
			onDidChangeTextDocument.dispose();
			onDidChangeViewState.dispose();

			if (this.activeWebviewPanel === webviewPanel) {
				this.activeWebviewPanel = null;
				this.outlineProvider.clear();
				this.wordCountStatusBar.hide();
				vscode.commands.executeCommand(
					'setContext',
					'markdownLiveEditor.outlineAvailable',
					false,
				);
			}
		});
	}

	private async getStyleSheet(): Promise<string> {
		if (this.styleCache) {
			return this.styleCache;
		}
		const bytes = await vscode.workspace.fs.readFile(this.styleUri);
		this.styleCache = Buffer.from(bytes).toString('utf8');
		return this.styleCache;
	}

	private getCustomStyle(): string {
		const config = vscode.workspace.getConfiguration('markdownLiveEditor');
		return config.get<string>('customCss', '') ?? '';
	}

	public async showExportOptions(): Promise<void> {
		if (!this.activeWebviewPanel) {
			vscode.window.showInformationMessage(
				'Open a Markdown Live Editor panel before exporting.',
			);
			return;
		}
		type ExportChoice = {
			label: string;
			mode: ExportMode;
		};
		const choices: ExportChoice[] = [
			{
				label: 'Copy HTML to clipboard',
				mode: 'clipboard',
			},
			{
				label: 'Export HTML file',
				mode: 'file',
			},
		];
		const selection = await vscode.window.showQuickPick(choices, {
			placeHolder: 'Export the current document as HTML',
		});
		if (!selection) {
			return;
		}
		const [style, customStyle] = await Promise.all([
			this.getStyleSheet(),
			this.getCustomStyle(),
		]);
		this.postExportRequest(selection.mode, style, customStyle);
	}

	private postExportRequest(
		mode: ExportMode,
		style: string,
		customStyle: string,
	): void {
		this.activeWebviewPanel?.webview.postMessage({
			type: 'requestExportHtml',
			mode,
			style,
			customStyle,
		});
	}

	private async handleExportHtml(message: ExportHtmlMessage): Promise<void> {
		if (message.mode === 'clipboard') {
			await vscode.env.clipboard.writeText(message.html);
			vscode.window.showInformationMessage('Copied HTML to clipboard');
			return;
		}
		const target = await vscode.window.showSaveDialog({
			filters: { HTML: ['html'] },
			title: 'Export Markdown Live Editor as HTML',
		});
		if (!target) {
			return;
		}
		await vscode.workspace.fs.writeFile(
			target,
			Buffer.from(message.html, 'utf8'),
		);
		vscode.window.showInformationMessage(`Exported HTML to ${target.fsPath}`);
	}
	private getHtmlForWebview(webview: vscode.Webview): string {
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'view.js'),
		);
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'style.css'),
		);
		const katexCssUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'katex.min.css'),
		);
		const mermaidUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, 'media', 'mermaid.js'),
		);
		const nonce = getNonce();

		const config = vscode.workspace.getConfiguration('markdownLiveEditor');
		const customCss = config.get<string>('customCss', '');
		const customStyleTag = customCss
			? `\n\t<style nonce="${nonce}">${customCss}</style>`
			: '';

		return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}' ${webview.cspSource} 'unsafe-eval'; img-src ${webview.cspSource} https: data: blob:;">
	<link href="${katexCssUri}" rel="stylesheet">
	<link href="${styleUri}" rel="stylesheet">${customStyleTag}
	<title>Markdown Live Editor</title>
</head>
<body>
	<div id="editor" data-mermaid-uri="${mermaidUri}"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce(): string {
	let text = '';
	const possible =
		'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
