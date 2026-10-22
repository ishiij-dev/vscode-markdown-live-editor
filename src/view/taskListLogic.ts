/**
 * Hit testing for the GFM task list checkbox.
 *
 * The checkbox has no DOM node of its own: `style.css` draws it as
 * `li[data-checked]::before`, an absolutely positioned box at the left edge of
 * the list item (`left: 0; top: 0.25em; width: 1em; height: 1em`). The values
 * below mirror that rule, so they must be kept in sync with it.
 */

const CHECKBOX_LEFT_EM = 0;
const CHECKBOX_TOP_EM = 0.25;
const CHECKBOX_SIZE_EM = 1;

/** Extra px around the drawn box, so the edges are not hard to hit. */
const HIT_SLOP_PX = 2;

export interface CheckboxHitTest {
	/** Click X relative to the list item's border box. */
	offsetX: number;
	/** Click Y relative to the list item's border box. */
	offsetY: number;
	/** Computed font size of the list item, in px. */
	fontSize: number;
}

/**
 * True when a click landed on the checkbox itself rather than on the item's
 * text or the margin around it.
 */
export function isInsideTaskCheckbox({
	offsetX,
	offsetY,
	fontSize,
}: CheckboxHitTest): boolean {
	const left = CHECKBOX_LEFT_EM * fontSize - HIT_SLOP_PX;
	const right = (CHECKBOX_LEFT_EM + CHECKBOX_SIZE_EM) * fontSize + HIT_SLOP_PX;
	const top = CHECKBOX_TOP_EM * fontSize - HIT_SLOP_PX;
	const bottom = (CHECKBOX_TOP_EM + CHECKBOX_SIZE_EM) * fontSize + HIT_SLOP_PX;

	return (
		offsetX >= left && offsetX <= right && offsetY >= top && offsetY <= bottom
	);
}
