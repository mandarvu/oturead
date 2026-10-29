import { renderDisplay, renderInline } from "./latex"

// Finds LaTeX math in markdown and replaces it with rendered Unicode, wrapped
// in private-use marker characters so the renderer can style it (see
// markdown-ext.ts). Code fences, code spans and escaped dollars are skipped,
// and "$5 and $10" is not math (Pandoc's rules for $…$).

export const MATH_OPEN = ""
export const MATH_CLOSE = ""

const FENCE = /^ {0,3}(`{3,}|~{3,})/
const DISPLAY_ENVS = "equation|align|alignat|gather|multline|eqnarray|displaymath|math"
const DISPLAY_START = new RegExp(`^((?:[ \\t]*>)*[ \\t]*)(\\$\\$|\\\\\\[|\\\\begin\\{(?:${DISPLAY_ENVS})\\*?\\})`)

// Streaming re-renders the whole document for every chunk, so remember
// rendered expressions. Bounded: cleared when it grows too large.
const cache = new Map<string, string | undefined>()

function cached(key: string, render: () => string): string | undefined {
  if (cache.has(key)) return cache.get(key)
  let result: string | undefined
  try {
    result = render()
  } catch {
    result = undefined
  }
  if (cache.size > 5000) cache.clear()
  cache.set(key, result)
  return result
}

/** Replaces inline math in one line of markdown with `wrap(rendered)`. */
export function replaceInlineMath(line: string, wrap: (math: string) => string): string {
  if (!line.includes("$") && !line.includes("\\(")) return line
  let out = ""
  let i = 0
  const emit = (latex: string, end: number, fallback: string) => {
    const rendered = latex.trim() ? cached(`i${latex}`, () => renderInline(latex)) : undefined
    out += rendered === undefined ? fallback : wrap(rendered)
    i = end
  }
  while (i < line.length) {
    const c = line[i]!
    if (c === "`") {
      let run = 1
      while (line[i + run] === "`") run++
      const fence = "`".repeat(run)
      let close = line.indexOf(fence, i + run)
      while (close !== -1 && line[close + run] === "`") close = line.indexOf(fence, close + run + 1)
      const end = close === -1 ? i + run : close + run
      out += line.slice(i, end)
      i = end
      continue
    }
    if (c === "\\" && line[i + 1] === "(") {
      const close = line.indexOf("\\)", i + 2)
      if (close !== -1) {
        emit(line.slice(i + 2, close), close + 2, line.slice(i, close + 2))
        continue
      }
    }
    if (c === "\\") {
      out += line.slice(i, i + 2) // escapes, including \$
      i += 2
      continue
    }
    if (c === "$" && line[i + 1] === "$") {
      const close = line.indexOf("$$", i + 2)
      if (close !== -1) {
        emit(line.slice(i + 2, close), close + 2, line.slice(i, close + 2))
        continue
      }
      out += "$$"
      i += 2
      continue
    }
    if (c === "$" && line[i + 1] !== undefined && !/\s/.test(line[i + 1]!)) {
      let close = -1
      for (let j = i + 1; j < line.length; j++) {
        if (line[j] === "\\") {
          j++
          continue
        }
        if (line[j] === "$" && !/\s/.test(line[j - 1]!) && !/[0-9]/.test(line[j + 1] ?? "")) {
          close = j
          break
        }
      }
      if (close !== -1) {
        emit(line.slice(i + 1, close), close + 1, line.slice(i, close + 1))
        continue
      }
    }
    out += c
    i++
  }
  return out
}

/** Inline math in `text` as plain rendered text, e.g. for headings in the table of contents. */
export function mathToText(text: string): string {
  return replaceInlineMath(text, (math) => math)
}

export type MathRendered = {
  content: string
  /** Original 0-based line for a 0-based line of `content`. */
  toSource: (line: number) => number
}

/** Renders all math in `markdown`; display math becomes indented 2D blocks. */
export function renderMathInMarkdown(markdown: string): MathRendered {
  if (!markdown.includes("$") && !markdown.includes("\\(") && !markdown.includes("\\[") && !markdown.includes("\\begin")) {
    return { content: markdown, toSource: (line) => line }
  }
  const lines = markdown.split("\n")
  const out: string[] = []
  const map: number[] = []
  let fence: string | undefined

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const marker = FENCE.exec(line)?.[1]
    if (marker) {
      if (!fence) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined
    }
    if (fence || marker) {
      out.push(line)
      map.push(i)
      continue
    }

    const display = DISPLAY_START.exec(line)
    const block = display && collectDisplay(lines, i, display[1]!, display[2]!)
    if (block) {
      const rendered = cached(`d${block.latex}`, () => renderDisplay(block.latex).join("\n"))
      if (rendered !== undefined) {
        rendered.split("\n").forEach((row, k) => {
          out.push(`${display[1]}${MATH_OPEN}  ${row}${MATH_CLOSE}`)
          map.push(i + Math.min(k, block.end - i))
        })
        if (block.trailing.trim()) {
          out.push(display[1] + replaceInlineMath(block.trailing, wrapMarked))
          map.push(block.end)
        }
        i = block.end
        continue
      }
    }

    out.push(replaceInlineMath(line, wrapMarked))
    map.push(i)
  }
  return { content: out.join("\n"), toSource: (line) => map[Math.max(0, Math.min(line, map.length - 1))] ?? 0 }
}

const wrapMarked = (math: string) => MATH_OPEN + math + MATH_CLOSE

/** The LaTeX of a display block starting at line `start`, or null if it isn't closed (e.g. still streaming). */
function collectDisplay(lines: string[], start: number, prefix: string, open: string) {
  const env = /^\\begin\{(.+)\}$/.exec(open)?.[1]
  const close = open === "$$" ? "$$" : open === "\\[" ? "\\]" : `\\end{${env}}`
  let text = lines[start]!.slice(prefix.length + open.length)
  for (let i = start; i < lines.length && i < start + 200; i++) {
    if (i > start) {
      const line = lines[i]!
      if (line.trim() === "" || line.trim() === prefix.trim()) return null // a paragraph break: not a display block
      text += "\n" + (line.startsWith(prefix) ? line.slice(prefix.length) : line)
    }
    const at = text.indexOf(close, i === start ? 0 : text.lastIndexOf("\n") + 1)
    if (at !== -1) {
      const body = text.slice(0, at)
      return {
        latex: env ? `${open}${body}${close}` : body,
        trailing: text.slice(at + close.length),
        end: i,
      }
    }
  }
  return null
}
