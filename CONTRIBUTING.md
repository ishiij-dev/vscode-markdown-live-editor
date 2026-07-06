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

## Release

Use this checklist for patch or minor releases.

### 1. Update release metadata

- Bump `version` in `package.json`
- Sync the root package version entries in `package-lock.json`
- Add a new entry to `CHANGELOG.md`

### 2. Run local validation

```bash
npm run test:all
npm run lint
npm run package
npx vsce package --no-dependencies
```

### 3. Open and merge a PR

- Create a branch from `main`
- Commit only the release metadata changes
- Open a draft PR and merge it after review

### 4. Tag the merged commit

After the PR is merged, tag the `main` commit that contains the version bump:

```bash
git fetch origin main --tags
git tag -a vX.Y.Z origin/main -m "Release vX.Y.Z"
git push origin vX.Y.Z
```

Pushing a `v*` tag triggers `.github/workflows/publish.yml`, which publishes to:

- VS Code Marketplace via `vsce publish`
- Open VSX via `ovsx publish`
- GitHub Releases via `gh release create`

### 5. Required secrets

The publish workflow depends on these GitHub Actions secrets:

- `VSCE_PAT` for VS Code Marketplace publishing
- `OVSX_PAT` for Open VSX publishing

If publishing fails with an authentication error, rotate the token in the relevant service and update the GitHub Actions secret.

### 6. Common publish failure

If the `Publish to VS Code Marketplace` step fails with an expired token error, update `VSCE_PAT` in:

- GitHub repository `Settings` -> `Secrets and variables` -> `Actions`

Then re-run the failed jobs for the publish workflow.

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
