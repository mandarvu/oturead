import { addDefaultParsers, getTreeSitterClient, infoStringToFiletype } from "@opentui/core"
import parsers from "./parsers-config"

let registered = false

/**
 * Registers the grammars and starts the tree-sitter worker right away, loading
 * the markdown grammars plus those of any fenced code blocks in `markdown`.
 * Without this, the worker only spins up when the first block asks to be
 * highlighted, which delays the first meaningful paint.
 */
export function warmUpHighlighter(markdown = "") {
  if (!registered) {
    // Syntax highlighting for ~35 languages, same grammar set as opencode.
    // Grammars are fetched on first use and cached under $XDG_DATA_HOME.
    addDefaultParsers(parsers.parsers)
    registered = true
  }
  const filetypes = new Set(["markdown", "markdown_inline"])
  for (const match of markdown.matchAll(/^[ \t]*(?:```|~~~)[ \t]*([^\s`]+)/gm)) {
    const filetype = infoStringToFiletype(match[1]!)
    if (filetype) filetypes.add(filetype)
  }
  const client = getTreeSitterClient()
  void client
    .initialize()
    .then(() => Promise.all([...filetypes].map((filetype) => client.preloadParser(filetype).catch(() => false))))
    .catch(() => {})
}
