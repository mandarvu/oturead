// Maps between rendered rows and source lines, so the editor can open where
// the reader is looking and the reader can return there afterwards.

export type BlockSpan = {
  /** 0-based source line where the block starts. */
  line: number
  /** Number of source lines the block spans (at least 1). */
  lines: number
  /** Rendered row where the block starts, relative to the document top. */
  offset: number
  /** Rendered height in rows (at least 1). */
  height: number
}

/** 0-based start line and line count of each block's raw text within `content`. */
export function locateBlocks(content: string, raws: string[]): { line: number; lines: number }[] {
  const out: { line: number; lines: number }[] = []
  let pos = 0
  let line = 0
  for (const raw of raws) {
    const text = raw.replace(/\n+$/, "")
    const at = text ? content.indexOf(text, pos) : -1
    if (at >= 0) {
      line += countNewlines(content, pos, at)
      pos = at
    }
    const lines = text.split("\n").length
    out.push({ line, lines })
    if (at >= 0) {
      line += lines - 1
      pos = at + text.length
    }
  }
  return out
}

function countNewlines(text: string, from: number, to: number) {
  let n = 0
  for (let i = text.indexOf("\n", from); i !== -1 && i < to; i = text.indexOf("\n", i + 1)) n++
  return n
}

/** 0-based source line shown at rendered row `row`. */
export function lineAtRow(blocks: BlockSpan[], row: number): number {
  let current: BlockSpan | undefined
  for (const block of blocks) {
    if (block.offset > row) {
      // `row` falls in the gap before this block: point at the block below.
      if (current && row >= current.offset + current.height) return block.line
      break
    }
    current = block
  }
  if (!current) return 0
  const into = Math.min(row - current.offset, current.lines - 1, current.height - 1)
  return current.line + Math.max(0, into)
}

/** Rendered row at which 0-based source `line` is shown. */
export function rowOfLine(blocks: BlockSpan[], line: number): number {
  let current: BlockSpan | undefined
  for (const block of blocks) {
    if (block.line > line) break
    current = block
  }
  if (!current) return 0
  return current.offset + Math.min(line - current.line, current.height - 1)
}

/**
 * Where 0-based `line` of `before` ended up in `after`, so the reader stays on
 * the same text when lines were added or removed above it. Lines inside the
 * edited region keep their number.
 */
export function followLine(before: string, after: string, line: number): number {
  const a = before.split("\n")
  const b = after.split("\n")
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++
  if (line < prefix) return line
  let suffix = 0
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) {
    suffix++
  }
  if (line >= a.length - suffix) return line + (b.length - a.length)
  return Math.min(line, b.length - 1)
}
