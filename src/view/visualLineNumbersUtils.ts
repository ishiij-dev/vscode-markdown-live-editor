export interface ShouldRenderVisualLineNumbersUpdateInput {
	isBlocked: boolean;
	enabled: boolean;
	docChanged: boolean;
	selChanged: boolean;
}

export function shouldRenderVisualLineNumbersUpdate(
	input: ShouldRenderVisualLineNumbersUpdateInput,
): boolean {
	if (input.isBlocked) return false;
	if (!input.enabled) return false;
	return input.docChanged || input.selChanged;
}
