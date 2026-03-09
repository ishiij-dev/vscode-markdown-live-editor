# Changelog

All notable changes to Markdown Live Editor will be documented in this file.

## [0.3.0] - 2026-03-09

### Added

- In-editor Find panel in the webview (`Ctrl/Cmd+F`)
- Match navigation with `Enter`, `F3`, `Ctrl/Cmd+G`, and reverse navigation with `Shift` variants
- Search result highlights with active match styling
- No-results visual feedback in the search input

### Changed

- Refactor search logic into modular search state utilities for better testability
- Keep find panel count and no-results state synchronized on document updates
- Improve active match reveal behavior with centered smooth scrolling

## [0.2.1] - 2026-03-02

### Changed

- Lower minimum VS Code engine version from `^1.109.0` to `^1.75.0` for Cursor editor compatibility
- Add OpenVSX Registry publish step to release workflow

## [0.2.0] - 2026-03-02

### Added

- YAML Frontmatter support — `---` blocks are recognized and displayed as a collapsible block
- Click-to-expand: click the "Frontmatter" header to reveal YAML content
- Editable: edit frontmatter directly in the WYSIWYG view via textarea
- Round-trip safe: frontmatter content is preserved exactly during serialization

## [0.1.0] - 2026-02-28

### Added

- Word and character count in the status bar
- Selection count display when text is selected (e.g. Words: 10/123 | Chars: 30/456)
- Auto-update on document edits and selection changes
- Status bar auto-hides when editor is not active

## [0.0.6] - 2026-02-26

### Added

- Outline panel in Explorer sidebar — displays heading hierarchy (H1–H6) as a TreeView
- Click-to-scroll: click any heading in the outline to smooth-scroll the editor to that position
- Auto-update: outline refreshes on document edits and tab switches
- Panel auto-hides when Markdown Live Editor is not active

## [0.0.5] - 2026-02-25

### Added

- Floating selection toolbar — select text to show Bold, Italic, Strikethrough, Code, and Link buttons
- Link tooltip — hover over links to preview URL with edit/delete actions
- Custom link edit tooltip that always positions above the text (bypasses floating-ui flip)

### Fixed

- Link edit tooltip no longer flips below the text when space is limited above
- Tooltip focus handling: avoid unnecessary focus calls when tooltip is not visible

## [0.0.4] - 2026-02-24

### Added

- Relative path image display in the editor (resolves local images via webview URI)
- Error fallback display for missing images
- Workspace root access for images in parent directories

## [0.0.3] - 2026-02-24

### Added

- Slash commands — type `/` to insert headings, lists, tables, code blocks, math, mermaid diagrams, and more
- Keyboard navigation (Arrow keys, Enter, Escape) and text filtering in slash menu

## [0.0.2] - 2026-02-24

### Changed

- CI: exclude devDependencies from npm audit

## [0.0.1] - 2026-02-21

### Added

- WYSIWYG Markdown editing with Milkdown (ProseMirror-based)
- Bidirectional sync between visual editor and source file
- GFM support: tables, task lists, strikethrough, footnotes
- Syntax highlighting for code blocks via highlight.js (27 languages)
- Mermaid diagram live preview (lazy-loaded separate bundle)
- KaTeX math rendering (inline `$...$` and block `$$...$$`)
- GitHub Alerts (`[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`)
- Emoji shortcodes (`:smile:`, `:rocket:`, etc.)
- Custom CSS injection via `markdownLiveEditor.customCss` setting
- VS Code theme integration (light/dark/high-contrast)
