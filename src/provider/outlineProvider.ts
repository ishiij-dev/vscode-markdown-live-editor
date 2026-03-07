import * as vscode from 'vscode';
import type { HeadingItem } from '../protocol/messages';

class HeadingTreeItem extends vscode.TreeItem {
	constructor(
		public readonly heading: HeadingItem,
		public readonly children: HeadingTreeItem[],
	) {
		super(
			heading.text,
			children.length > 0
				? vscode.TreeItemCollapsibleState.Expanded
				: vscode.TreeItemCollapsibleState.None,
		);

		this.command = {
			command: 'markdownLiveEditor.scrollToHeading',
			title: 'Scroll to Heading',
			arguments: [heading.pos],
		};

		this.description = `H${heading.level}`;
		this.tooltip = `H${heading.level}: ${heading.text}`;
		this.iconPath = new vscode.ThemeIcon('symbol-structure');
	}
}

export class OutlineProvider
	implements vscode.TreeDataProvider<HeadingTreeItem>
{
	private _onDidChangeTreeData = new vscode.EventEmitter<
		HeadingTreeItem | undefined
	>();
	readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	private roots: HeadingTreeItem[] = [];

	updateHeadings(items: HeadingItem[]): void {
		this.roots = this.buildTree(items);
		this._onDidChangeTreeData.fire(undefined);
	}

	clear(): void {
		this.roots = [];
		this._onDidChangeTreeData.fire(undefined);
	}

	getTreeItem(element: HeadingTreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(element?: HeadingTreeItem): HeadingTreeItem[] {
		if (!element) {
			return this.roots;
		}
		return element.children;
	}

	/**
	 * Build a hierarchical tree from a flat heading list using a stack.
	 * Handles skipped levels (e.g. H1 → H3) by nesting under the nearest parent.
	 */
	private buildTree(items: HeadingItem[]): HeadingTreeItem[] {
		interface TempNode {
			heading: HeadingItem;
			children: TempNode[];
		}

		const roots: TempNode[] = [];
		const stack: { node: TempNode; level: number }[] = [];

		for (const heading of items) {
			const node: TempNode = { heading, children: [] };

			while (
				stack.length > 0 &&
				stack[stack.length - 1].level >= heading.level
			) {
				stack.pop();
			}

			if (stack.length === 0) {
				roots.push(node);
			} else {
				stack[stack.length - 1].node.children.push(node);
			}

			stack.push({ node, level: heading.level });
		}

		function toTreeItem(node: TempNode): HeadingTreeItem {
			const children = node.children.map(toTreeItem);
			return new HeadingTreeItem(node.heading, children);
		}

		return roots.map(toTreeItem);
	}
}
