# oturead

A terminal markdown reader that renders documents the same way
[opencode](https://github.com/sst/opencode) renders streamed LLM output.

![showcase](docs/screenshot.png)

It uses the same building blocks as opencode's TUI:
[OpenTUI](https://github.com/sst/opentui)'s `MarkdownRenderable` in
`top-level` block mode, opencode's tree-sitter grammar list, opencode's syntax
style rules, and opencode's themes.

## Features

- **Syntax highlighting** for about 35 languages via tree-sitter: TypeScript,
  JavaScript, Python, Rust, Go, C, C++, C#, Java, Kotlin, Ruby, PHP, Scala,
  Bash, Lua, Haskell, OCaml, Elixir, Julia, Clojure, Nix, HCL, JSON, YAML,
  TOML, HTML, CSS, XML, Vue, Make, Vim, R, F#, Zig, diff, and more. Grammars
  download on first use and are cached in `~/.local/share/opentui`.
- **Tables** span the full width in a boxed grid, with inline formatting
  inside cells.
- **Heading colours by level**: H1 is bold and underlined, and H2 through H6
  each get their own colour. A breadcrumb in the title bar shows which
  section you're reading.
- **Table of contents** in a sidebar, and **collapsible sections**, for
  finding your way around long documents (see below).
- **Lists**: a different bullet at each nesting depth (`•` `◦` `▸`), coloured
  numbers, and `☐`/`☑` task checkboxes.
- **Blockquotes** have a coloured bar and italic text.
- **Inline styles**: bold, italic, strikethrough, `code`, links, `<u>underline</u>`
  / `<ins>`, and `==highlight==` / `<mark>`.
- **Streaming**: pipe an LLM's output straight in and watch it render live,
  the way opencode does.
- A **scrollbar** on the right edge, plus mouse wheel scrolling and
  select-to-copy over OSC 52, which works over SSH.
- **33 themes** (opencode, tokyonight, catppuccin, gruvbox, nord, dracula, …)
  in dark and light. Any opencode theme JSON works.

![code](docs/screenshot-code.png)

## Install

You need [Bun](https://bun.sh) and a truecolor terminal (kitty, ghostty,
WezTerm, Alacritty, foot, …).

```bash
bun install
bun run src/index.tsx examples/showcase.md

# or build a standalone binary
bun run build            # -> dist/oturead
cp dist/oturead ~/.local/bin/
```

## Usage

```bash
oturead README.md                    # read a file
oturead -w notes.md                  # re-render whenever the file changes
llm "explain monads" | oturead       # render streamed LLM output live
oturead -s examples/showcase.md      # replay a file as if an LLM were streaming it
oturead -s 1500 doc.md               # ...at 1500 chars/sec
oturead -t tokyonight -l doc.md      # pick a theme, light variant
oturead --list-themes
```

You can also set a default theme with the `OTUREAD_THEME` environment variable.

### Editing

Press `e` to open the file in your editor at the line at the top of the
screen. oturead checks `$VISUAL`, then `$EDITOR`, and falls back to `vi`. It
passes the line the way each editor expects: `+LINE` for vi, vim, nvim, nano,
emacs, micro, kak and others; `FILE:LINE` for helix; and `--wait --goto` for
VS Code, Cursor and similar. When the editor exits, oturead reloads the file
and scrolls back to the same place.

### Long documents

A table of contents sits on the left when the terminal is at least 100
columns wide. Press `o` to show or hide it. It highlights the section you're
reading and follows you as you scroll.

Press `Tab` to move into it. Then `j`/`k` move between sections and scroll
the document with you, `Space` folds or unfolds a section, `h`/`l` fold and
unfold, and `Enter` opens the section and takes you back to the document.
You can also click an entry to jump to it, or click its `▾`/`▸` marker to
fold it.

![folding](docs/screenshot-folding.png)

Folding hides a section's body (and its subsections) and leaves its heading
as `▸ Heading ⋯`:

- `z` folds or unfolds the section at the top of the screen.
- `1` to `6` fold every section at that depth, so `2` gives an overview of
  the top-level sections. `0` unfolds everything.
- `Z` switches between that overview and everything unfolded.

### Keys

| Key                     | Action                         |
|-------------------------|--------------------------------|
| `j` / `k`, `↓` / `↑`    | scroll one line                |
| `d` / `u`               | half page down / up            |
| `space` / `b`, PgDn/PgUp| full page down / up            |
| `g` / `G`, Home/End     | top / bottom                   |
| `]` / `[`, `n` / `p`    | next / previous heading        |
| `o`                     | show / hide the table of contents |
| `Tab`                   | focus the table of contents (`j`/`k`, `Space`, `h`/`l`, `Enter`, `Esc`) |
| `z`                     | fold / unfold the section at the top of the screen |
| `1`–`6`, `0`            | fold to that depth / unfold all |
| `Z`                     | fold to an overview / unfold all |
| `e`                     | edit the file in `$VISUAL` / `$EDITOR` at the line you're reading; returns there when you quit the editor |
| `t`                     | theme picker: type to fuzzy-search, ↑/↓ to preview live, Enter to apply, Esc to revert |
| `m`                     | toggle dark / light            |
| `r`                     | toggle rendered / raw markdown |
| mouse drag              | select text and copy it        |
| `?`                     | help                           |
| `q`, `Ctrl+C`           | quit                           |

## Custom themes

Put opencode-format theme files (`*.json`) in `~/.config/oturead/themes/`.
Themes in `~/.config/opencode/themes/` are picked up too.

## How it works

| File                   | Purpose |
|------------------------|---------|
| `src/index.tsx`        | CLI: parses arguments, picks the source (file, watch, stdin, or simulated stream) and starts tree-sitter warming up. When stdin is a pipe, keyboard input is read from `/dev/tty`. |
| `src/App.tsx`          | The UI: title bar with breadcrumb, a scrollbox around `<markdown>`, status bar, help overlay, and key bindings. |
| `src/Toc.tsx`          | The table of contents sidebar. |
| `src/outline.ts`       | Parses headings into the section tree behind the table of contents, the breadcrumb and folding. |
| `src/fold.ts`          | Builds the folded markdown for collapsed sections, and maps its lines back to the source. |
| `src/ThemePicker.tsx`  | The floating, fuzzy-searchable theme list with live preview. |
| `src/theme.ts`         | Resolves opencode v1 themes and builds the tree-sitter style table (based on opencode's `syntax.ts`). |
| `src/markdown-ext.ts`  | Small additions to OpenTUI's `MarkdownRenderable`: underline and highlight, bullet and checkbox markers, quote bar colour, and painting text on the first frame. |
| `src/highlight.ts`     | Registers the grammars and preloads the ones the document needs, while the renderer is still starting up. |
| `src/progressive.ts`   | Picks the leading blocks of a large document to render first. |
| `src/position.ts`      | Maps between rendered rows and source lines, for the editor, folding and the table of contents. |
| `src/editor.ts`        | Works out the editor command and launches it at a given line. |
| `src/fuzzy.ts`         | The fuzzy matcher used by the theme picker. |
| `src/parsers-config.ts`| The tree-sitter grammar list from opencode, plus extra fence aliases (`shell`, `golang`, `tf`, `jsonc`, …). |
| `src/themes/`          | The bundled opencode themes. |
| `scripts/snapshot.tsx` | Renders a file headlessly to HTML; used for the screenshots above. |

## Development

```bash
bun test          # unit tests
bun run typecheck
bun run demo      # simulated streaming of examples/showcase.md
```

## Credits

The themes and the tree-sitter grammar configuration come from
[opencode](https://github.com/sst/opencode), which is MIT licensed.
