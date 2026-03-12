# Contributing

## Prerequisites

- Node.js 22+
- npm

## Setup

```bash
git clone https://github.com/jishii1204/vscode-markdown-live-editor.git
cd vscode-markdown-live-editor
npm install
```

## Run in Development

1. Open this project in VS Code
2. Press `F5` to launch the Extension Development Host
3. Open any `.md` file, then use the command palette or context menu to open it with Markdown Live Editor

## Build

```bash
npm run compile
```

## Lint

```bash
npm run lint        # Check
npm run lint:fix    # Auto-fix
```

## PR Labels and Quality Workflow

To keep quality work discoverable and triage-friendly, apply labels on every PR:

- Add `quality` for reliability/process/test/maintainability improvements
- Add one `area:*` label that best matches the primary change area
  - Examples: `area:test`, `area:sync`, `area:search`, `area:input`, `area:editor-core`

For quality-related PRs, include these details in the PR description:

- Reproduction steps (if fixing a behavior/regression)
- Expected result
- Impact scope
- Rollback condition

This repository tracks release-freeze readiness using issue metrics (see #66/#73), so label consistency is part of the operating rule.

## Tech Stack

- TypeScript
- VS Code Extension API (CustomTextEditorProvider)
- [Milkdown](https://milkdown.dev/) — WYSIWYG Markdown editor framework
- [ProseMirror](https://prosemirror.net/) — Rich text editing toolkit
- [highlight.js](https://highlightjs.org/) — Syntax highlighting
- [Mermaid](https://mermaid.js.org/) — Diagram rendering
- [KaTeX](https://katex.org/) — Math typesetting
- [esbuild](https://esbuild.github.io/) — Bundler
- [Biome](https://biomejs.dev/) — Linter & formatter
