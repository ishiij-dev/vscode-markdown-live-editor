# Markdown Live Editor

[![VS Marketplace](https://img.shields.io/visual-studio-marketplace/v/jishii1204.markdown-live-editor)](https://marketplace.visualstudio.com/items?itemName=jishii1204.markdown-live-editor)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/jishii1204.markdown-live-editor)](https://marketplace.visualstudio.com/items?itemName=jishii1204.markdown-live-editor)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A WYSIWYG Markdown editor for Visual Studio Code.
Edit your Markdown files visually — what you see is what you get.

![Markdown Live Editor Demo](images/demo.gif)

## Installation

Launch VS Code Quick Open (`Ctrl+P`), paste the following command, and press enter.

```
ext install jishii1204.markdown-live-editor
```

## Features

- **WYSIWYG editing** — Edit Markdown visually with [Milkdown](https://milkdown.dev/) (ProseMirror-based)
- **Bidirectional sync** — Changes in the visual editor update the source file, and vice versa
- **GFM support** — Tables, task lists, strikethrough, footnotes
- **Selection toolbar** — Select text to show Bold, Italic, Strikethrough, Code, and Link buttons
- **Link tooltip** — Hover over links to preview URL with edit/delete actions
- **In-editor Find** — Search inside the webview editor with match highlights and keyboard navigation
- **Heading folding** — Collapse and expand sections by heading in the editor
- **Outline panel** — Heading hierarchy in the Explorer sidebar with click-to-scroll navigation
- **Syntax highlighting** — Code blocks with language-aware highlighting via [highlight.js](https://highlightjs.org/)
- **Mermaid diagrams** — Live preview of `mermaid` code blocks
- **KaTeX math** — Inline `$...$` and block `$$...$$` math rendering
- **GitHub Alerts** — `[!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`
- **Slash commands** — Type `/` to insert headings, lists, tables, code blocks, math, mermaid diagrams, and more
- **Emoji shortcodes** — `:smile:` → 😄, `:rocket:` → 🚀
- **Relative image paths** — Display local images referenced with relative paths
- **Custom CSS** — Inject your own styles via settings
- **Theme integration** — Adapts to light, dark, and high-contrast themes

## Usage

### Opening the Editor

| Method | How |
|--------|-----|
| **Command Palette** | `Ctrl+Shift+P` → `Markdown Live Editor: Open with Markdown Live Editor` |
| **Keyboard shortcut** | `Ctrl+Shift+Alt+M` (Mac: `Cmd+Shift+Alt+M`) while editing a `.md` file |
| **Explorer context menu** | Right-click a `.md` file → *Open with Markdown Live Editor* |
| **Editor tab context menu** | Right-click the tab of an open `.md` file |

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `markdownLiveEditor.customCss` | Custom CSS to inject into the editor | `""` |

### Export Styled HTML

You can export the current editor view as styled HTML in two ways:

- Command Palette: `Markdown Live Editor: Export Styled HTML`
- In-editor Find panel: click the export toggle (`⤴`), then choose `Copy` or `Export`

### Heading Folding

- Click the fold toggle next to a heading to collapse or expand its section
- Keyboard support: focus the toggle with `Tab`, then press `Enter` or `Space`

### In-editor Find Shortcuts

Because the editor runs inside a webview, it uses its own Find panel.

| Action | Shortcut |
|--------|----------|
| Open Find | `Ctrl+F` (Mac: `Cmd+F`) |
| Next match | `Enter`, `F3`, `Ctrl+G` (Mac: `Cmd+G`) |
| Previous match | `Shift+Enter`, `Shift+F3`, `Shift+Ctrl+G` (Mac: `Shift+Cmd+G`) |
| Close Find | `Esc` |

## Supported Markdown Features

| Feature | Syntax |
|---------|--------|
| Headings | `# H1` ... `###### H6` |
| Bold / Italic | `**bold**` / `*italic*` |
| Strikethrough | `~~text~~` |
| Links | `[text](url)` |
| Images | `![alt](url)` |
| Code blocks | ` ```language ` |
| Tables | GFM pipe tables |
| Task lists | `- [x] done` / `- [ ] todo` |
| Blockquotes | `> quote` |
| Footnotes | `text[^1]` / `[^1]: note` |
| Math (inline) | `$E=mc^2$` |
| Math (block) | `$$\sum_{i=1}^n i$$` |
| Mermaid | ` ```mermaid ` |
| GitHub Alerts | `> [!NOTE]`, `> [!WARNING]`, etc. |
| Emoji | `:smile:`, `:rocket:`, etc. |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and build instructions.

## License

[MIT](LICENSE)
