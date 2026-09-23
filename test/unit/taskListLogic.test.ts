import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { toggleTaskMarker } from '../../src/view/taskListLogic';

function taskAt(markdown: string, marker: string, checked: boolean) {
	return {
		type: 'listItem',
		checked,
		position: { start: { offset: markdown.indexOf(marker) } },
	};
}

describe('toggleTaskMarker', () => {
	it('changes only the selected parsed task marker in either direction', () => {
		const markdown = '# Tasks\n\n- [ ] First\n  * [x] Nested\n1. [ ] Ordered\n';
		const expected = '# Tasks\n\n- [ ] First\n  * [x] Nested\n1. [x] Ordered\n';
		assert.equal(
			toggleTaskMarker(
				markdown,
				{
					type: 'root',
					children: [
						{ type: 'code', position: { start: { offset: 0 } } },
						{
							...taskAt(markdown, '- [ ] First', false),
							children: [taskAt(markdown, '* [x] Nested', true)],
						},
						taskAt(markdown, '1. [ ] Ordered', false),
					],
				},
				2,
				true,
			),
			expected,
		);
		assert.equal(
			toggleTaskMarker(
				'- [x] Done\n',
				taskAt('- [x] Done\n', '- [x] Done', true),
				0,
				false,
			),
			'- [ ] Done\n',
		);
	});
});
