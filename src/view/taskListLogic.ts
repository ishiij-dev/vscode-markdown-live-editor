interface MarkdownNode {
	type: string;
	checked?: unknown;
	position?: { start: { offset?: number } };
	children?: MarkdownNode[];
}

export function toggleTaskMarker(
	markdown: string,
	root: MarkdownNode,
	taskIndex: number,
	checked: boolean,
): string {
	let currentTask = 0;
	let taskOffset: number | undefined;
	const visit = (node: MarkdownNode): void => {
		if (taskOffset !== undefined) return;
		const offset = node.position?.start.offset;
		if (
			node.type === 'listItem' &&
			typeof node.checked === 'boolean' &&
			typeof offset === 'number'
		) {
			if (currentTask === taskIndex) {
				taskOffset = offset;
				return;
			}
			currentTask += 1;
		}
		node.children?.forEach(visit);
	};
	visit(root);
	if (taskOffset === undefined) return markdown;
	const marker = markdown
		.slice(taskOffset)
		.match(/^(?:[-+*]|\d+[.)])\s+\[[ xX]\]/)?.[0];
	if (!marker) return markdown;
	const checkOffset = taskOffset + marker.lastIndexOf('[') + 1;
	return `${markdown.slice(0, checkOffset)}${checked ? 'x' : ' '}${markdown.slice(checkOffset + 1)}`;
}
