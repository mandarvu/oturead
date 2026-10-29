// The document's heading structure: drives the table of contents, the
// breadcrumb and section folding.

export type Section = {
  /** Stable id (slug of the heading text, de-duplicated), survives reloads. */
  id: string
  /** Heading level, 1-6. */
  level: number
  /** Nesting depth in the outline, 1 for top-level sections. */
  depth: number
  /** Heading text with inline markup removed. */
  text: string
  /** 0-based line of the heading. */
  line: number
  /** 0-based line where the section ends (exclusive): the next heading of the same or higher level, or EOF. */
  end: number
  /** Whether anything but blank lines follows the heading within the section. */
  hasBody: boolean
  /** Index of the enclosing section, if any. */
  parent?: number
}

const ATX_HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/
const FENCE = /^ {0,3}(`{3,}|~{3,})/

/** Heading text with inline markdown (emphasis, code, links, tags) removed. */
export function plainHeading(text: string): string {
  return text
    .replace(/<\/?[a-z]+>/gi, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`~=]+/g, "")
    .trim()
}

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .trim()
      .replace(/\s+/g, "-") || "section"
  )
}

/** Parses ATX headings (outside code fences and YAML front matter) into sections. */
export function parseOutline(markdown: string): Section[] {
  const lines = markdown.split("\n")
  const sections: Section[] = []
  const seen = new Map<string, number>()
  let fence: string | undefined
  let start = 0

  // Skip YAML front matter, whose comments look like headings.
  if (lines[0] === "---") {
    const close = lines.findIndex((l, i) => i > 0 && (l === "---" || l === "..."))
    if (close > 0) start = close + 1
  }

  for (let i = start; i < lines.length; i++) {
    const line = lines[i]!
    const marker = FENCE.exec(line)?.[1]
    if (marker) {
      if (!fence) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined
      continue
    }
    if (fence) continue
    const match = ATX_HEADING.exec(line)
    if (!match) continue

    const text = plainHeading(match[2] ?? "")
    const base = slug(text)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    sections.push({
      id: count ? `${base}-${count}` : base,
      level: match[1]!.length,
      depth: 1,
      text,
      line: i,
      end: lines.length,
      hasBody: false,
    })
  }

  // Close sections and link parents with a stack of open sections.
  const open: number[] = []
  sections.forEach((section, index) => {
    while (open.length && sections[open[open.length - 1]!]!.level >= section.level) {
      sections[open.pop()!]!.end = section.line
    }
    const parent = open[open.length - 1]
    if (parent !== undefined) {
      section.parent = parent
      section.depth = sections[parent]!.depth + 1
    }
    open.push(index)
  })

  for (const section of sections) {
    for (let i = section.line + 1; i < section.end; i++) {
      if (lines[i]!.trim() !== "") {
        section.hasBody = true
        break
      }
    }
  }
  return sections
}

/** Index of the innermost section containing 0-based `line`, or -1 before the first heading. */
export function sectionAt(sections: Section[], line: number): number {
  let found = -1
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i]!
    if (section.line > line) break
    if (line < section.end) found = i
  }
  return found
}

/** `index` and its ancestors, outermost first. */
export function ancestry(sections: Section[], index: number): number[] {
  const chain: number[] = []
  for (let i: number | undefined = index; i !== undefined && i >= 0; i = sections[i]!.parent) chain.unshift(i)
  return chain
}
