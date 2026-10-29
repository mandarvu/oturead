import type { Section } from "./outline"

// Collapsing works on the markdown source: a collapsed section keeps its
// heading (marked "▸ … ⋯") and loses its body. The renderer then simply
// renders less, and `toSource` maps rendered lines back to the original
// so editing and position tracking keep using real line numbers.

export const FOLDED_PREFIX = "▸ "
export const FOLDED_SUFFIX = " ⋯"

export type Folded = {
  content: string
  /** Original 0-based line for a 0-based line of `content`. */
  toSource: (line: number) => number
}

const HEADING = /^( {0,3}#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/

function markFolded(line: string): string {
  const match = HEADING.exec(line)
  if (!match) return line
  return `${match[1]} ${FOLDED_PREFIX}${match[2] ?? ""}${FOLDED_SUFFIX}`
}

/** Removes the bodies of collapsed sections (those with a body; nested collapses are subsumed). */
export function foldMarkdown(markdown: string, sections: Section[], collapsed: ReadonlySet<string>): Folded {
  const folding = sections.filter((s) => s.hasBody && collapsed.has(s.id))
  if (folding.length === 0) return { content: markdown, toSource: (line) => line }

  const byLine = new Map(folding.map((s) => [s.line, s]))
  const lines = markdown.split("\n")
  const out: string[] = []
  const map: number[] = []
  for (let i = 0; i < lines.length; i++) {
    const section = byLine.get(i)
    if (!section) {
      out.push(lines[i]!)
      map.push(i)
      continue
    }
    // Heading plus a blank line, so whatever follows stays a separate block.
    out.push(markFolded(lines[i]!), "")
    map.push(i, i)
    i = section.end - 1
  }
  return { content: out.join("\n"), toSource: (line) => map[Math.max(0, Math.min(line, map.length - 1))] ?? 0 }
}
