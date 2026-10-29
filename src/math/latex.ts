import {
  ACCENT,
  BIG_OPERATOR,
  BINARY,
  FONTS,
  FUNCTIONS,
  GREEK,
  LIMITS,
  RELATION,
  SPACE,
  SUBSCRIPT,
  SUPERSCRIPT,
  SYMBOL,
  TALL_DELIMITER,
  VULGAR_FRACTION,
} from "./symbols"

// A small LaTeX math parser with two renderers: `renderInline` produces one
// line of Unicode (x², √(a+b), ∑ᵢ), `renderDisplay` lays math out in 2D
// (stacked fractions, raised exponents, limits under ∑, tall brackets).

type Kind = "ord" | "bin" | "rel" | "op" | "open" | "close" | "punct" | "space"

export type MathNode =
  | { t: "sym"; s: string; kind: Kind }
  | { t: "row"; items: MathNode[] }
  | { t: "scripts"; base: MathNode; sup?: MathNode; sub?: MathNode; limits: boolean }
  | { t: "frac"; num: MathNode; den: MathNode; binom: boolean }
  | { t: "sqrt"; body: MathNode; index?: MathNode }
  | { t: "accent"; mark: string; body: MathNode }
  | { t: "fenced"; open: string; close: string; body: MathNode }
  | { t: "grid"; env: string; rows: MathNode[][] }

const sym = (s: string, kind: Kind = "ord"): MathNode => ({ t: "sym", s, kind })
const EMPTY: MathNode = { t: "row", items: [] }

const FRACTIONS = new Set(["frac", "dfrac", "tfrac", "cfrac"])
const BINOMS = new Set(["binom", "dbinom", "tbinom"])
const TEXT = new Set(["text", "textrm", "textnormal", "textit", "textbf", "textsf", "texttt", "mbox", "hbox", "mathrm", "mathit", "mathnormal"])
const IGNORED = new Set([
  "displaystyle", "textstyle", "scriptstyle", "scriptscriptstyle", "nonumber", "notag", "label", "tag",
  "big", "Big", "bigg", "Bigg", "bigl", "bigr", "Bigl", "Bigr", "biggl", "biggr", "Biggl", "Biggr", "middle",
  "left", "right", "limits", "nolimits", "allowbreak", "relax",
])
const WITH_ARGUMENT_IGNORED = new Set(["label", "tag", "color", "hspace", "vspace", "phantom", "hphantom", "vphantom"])
const NEGATED: Record<string, string> = { "=": "≠", "∈": "∉", "⊂": "⊄", "⊆": "⊈", "≡": "≢", "∃": "∄", "<": "≮", ">": "≯", "∼": "≁" }

/** Splits `raw` at `separator` outside braces and nested environments. */
function splitTop(raw: string, separator: string): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]!
    if (c === "\\") {
      if (raw.startsWith("\\begin", i)) depth++
      else if (raw.startsWith("\\end", i)) depth--
      else if (separator === "\\\\" && raw[i + 1] === "\\" && depth === 0) {
        parts.push(raw.slice(start, i))
        start = i + 2
      }
      i++ // skip the escaped character
    } else if (c === "{") depth++
    else if (c === "}") depth--
    else if (c === separator && depth === 0) {
      parts.push(raw.slice(start, i))
      start = i + 1
    }
  }
  parts.push(raw.slice(start))
  return parts
}

class Parser {
  private i = 0
  constructor(private readonly src: string) {}

  private get done() {
    return this.i >= this.src.length
  }

  private skipSpaces() {
    while (!this.done && /\s/.test(this.src[this.i]!)) this.i++
  }

  /** Raw text of a `{...}` group (without braces), or of the next single token. */
  private rawArgument(): string {
    this.skipSpaces()
    if (this.src[this.i] === "{") return this.balanced("{", "}")
    if (this.src[this.i] === "\\") {
      const start = this.i++
      if (/[a-zA-Z]/.test(this.src[this.i] ?? "")) while (/[a-zA-Z]/.test(this.src[this.i] ?? "")) this.i++
      else this.i++
      return this.src.slice(start, this.i)
    }
    return this.src[this.i++] ?? ""
  }

  private balanced(open: string, close: string): string {
    let depth = 0
    const start = this.i + 1
    for (; this.i < this.src.length; this.i++) {
      const c = this.src[this.i]
      if (c === "\\") this.i++
      else if (c === open) depth++
      else if (c === close && --depth === 0) return this.src.slice(start, this.i++)
    }
    return this.src.slice(start)
  }

  /** Raw text up to the `\right` (or `\end{name}`) matching the current nesting level. */
  private until(open: RegExp, close: RegExp): string {
    const start = this.i
    let depth = 1
    while (this.i < this.src.length) {
      const rest = this.src.slice(this.i)
      if (open.test(rest)) depth++
      else if (close.test(rest) && --depth === 0) {
        const body = this.src.slice(start, this.i)
        this.i += close.exec(rest)![0].length
        return body
      }
      this.i += this.src[this.i] === "\\" ? 2 : 1
    }
    return this.src.slice(start)
  }

  private argument(): MathNode {
    return parseRow(this.rawArgument())
  }

  private delimiter(): string {
    this.skipSpaces()
    const raw = this.rawArgument()
    if (raw === ".") return ""
    if (raw.startsWith("\\")) return SYMBOL[raw.slice(1)] ?? raw.slice(1)
    return raw
  }

  row(): MathNode {
    const items: MathNode[] = []
    while (!this.done) {
      this.skipSpaces()
      if (this.done) break
      const atom = this.atom()
      if (!atom) continue
      let node: MathNode = atom
      // Postfix: scripts and primes.
      for (;;) {
        this.skipSpaces()
        const c = this.src[this.i]
        if (c !== "^" && c !== "_" && c !== "'") break
        this.i++
        const script = c === "'" ? sym("′") : this.scriptArgument()
        const base: Extract<MathNode, { t: "scripts" }> =
          node.t === "scripts" ? node : { t: "scripts", base: node, limits: hasLimits(node) }
        if (c === "_") base.sub = base.sub ? row([base.sub, script]) : script
        else base.sup = base.sup ? row([base.sup, script]) : script
        node = base
      }
      if (this.src.startsWith("\\limits", this.i) || this.src.startsWith("\\nolimits", this.i)) continue
      items.push(node)
    }
    return items.length === 1 ? items[0]! : { t: "row", items }
  }

  private scriptArgument(): MathNode {
    this.skipSpaces()
    if (this.src[this.i] === "{") return parseRow(this.balanced("{", "}"))
    return this.atom() ?? EMPTY
  }

  private atom(): MathNode | null {
    const c = this.src[this.i]!
    if (c === "{") return parseRow(this.balanced("{", "}"))
    if (c === "\\") return this.command()
    this.i++
    if (/[0-9.]/.test(c)) {
      let number = c
      while (/[0-9.]/.test(this.src[this.i] ?? "")) number += this.src[this.i++]
      return sym(number)
    }
    if (c === "^" || c === "_") {
      this.i-- // a script without a base
      return sym("")
    }
    switch (c) {
      case "+": return sym("+", "bin")
      case "-": return sym("−", "bin")
      case "*": return sym("∗", "bin")
      case "=": case "<": case ">": case ":": return sym(c, "rel")
      case ",": case ";": return sym(c, "punct")
      case "(": case "[": return sym(c, "open")
      case ")": case "]": return sym(c, "close")
      case "~": return sym(" ", "space")
      case "&": case "}": return null
      default: return sym(c)
    }
  }

  private command(): MathNode | null {
    this.i++ // backslash
    let name = this.src[this.i++] ?? ""
    if (/[a-zA-Z]/.test(name)) while (/[a-zA-Z]/.test(this.src[this.i] ?? "")) name += this.src[this.i++]
    let starred = false
    if (this.src[this.i] === "*" && /^(operatorname|begin|end)$/.test(name)) {
      starred = true
      this.i++
    }

    if (name in SPACE) return SPACE[name] ? sym(SPACE[name]!, "space") : null
    if (name in GREEK) return sym(GREEK[name]!)
    if (name in BINARY) return sym(BINARY[name]!, "bin")
    if (name in RELATION) return sym(RELATION[name]!, "rel")
    if (name in BIG_OPERATOR) return { ...sym(BIG_OPERATOR[name]!, "op"), limits: LIMITS.has(name) } as MathNode
    if (FUNCTIONS.has(name)) return { ...sym(name, "op"), limits: LIMITS.has(name) } as MathNode
    if (name === "langle" || name === "lceil" || name === "lfloor" || name === "lvert" || name === "lVert") return sym(SYMBOL[name]!, "open")
    if (name === "rangle" || name === "rceil" || name === "rfloor" || name === "rvert" || name === "rVert") return sym(SYMBOL[name]!, "close")
    if (name === "{" || name === "lbrace") return sym("{", "open")
    if (name === "}" || name === "rbrace") return sym("}", "close")
    if (name in SYMBOL) return sym(SYMBOL[name]!)

    if (FRACTIONS.has(name)) return { t: "frac", num: this.argument(), den: this.argument(), binom: false }
    if (BINOMS.has(name)) return { t: "frac", num: this.argument(), den: this.argument(), binom: true }
    if (name === "sqrt") {
      this.skipSpaces()
      const index = this.src[this.i] === "[" ? parseRow(this.balanced("[", "]")) : undefined
      return { t: "sqrt", body: this.argument(), index }
    }
    if (name === "left") {
      const open = this.delimiter()
      const body = this.until(/^\\left(?![a-zA-Z])/, /^\\right(?![a-zA-Z])/)
      return { t: "fenced", open, close: this.delimiter(), body: parseRow(body) }
    }
    if (/^[bB]igg?[lr]?$/.test(name)) {
      const d = this.delimiter()
      return sym(d, name.endsWith("l") ? "open" : name.endsWith("r") ? "close" : "ord")
    }
    if (TEXT.has(name)) return sym(this.rawArgument().replace(/[{}]/g, "").replace(/\\ /g, " "))
    if (name === "operatorname") return { ...sym(this.rawArgument().replace(/[{}\\]/g, ""), "op"), limits: starred } as MathNode
    if (name in FONTS) return restyle(this.argument(), FONTS[name]!)
    if (name in ACCENT) return { t: "accent", mark: ACCENT[name]!, body: this.argument() }
    if (name === "begin") {
      const env = this.rawArgument()
      if (env === "array" || env === "tabular") this.rawArgument() // column spec
      const escaped = env.replace(/\*/g, "\\*")
      const body = this.until(new RegExp(`^\\\\begin\\{${escaped}\\}`), new RegExp(`^\\\\end\\{${escaped}\\}`))
      return parseGrid(body, env.replace(/\*$/, ""))
    }
    if (name === "not") {
      this.skipSpaces()
      const next = this.atom()
      if (next?.t === "sym") return sym(NEGATED[next.s] ?? next.s + "̸", next.kind)
      return next
    }
    if (name === "stackrel" || name === "overset") {
      const over = this.argument()
      return { t: "scripts", base: this.argument(), sup: over, limits: true }
    }
    if (name === "underset") {
      const under = this.argument()
      return { t: "scripts", base: this.argument(), sub: under, limits: true }
    }
    if (name === "overbrace" || name === "underbrace" || name === "boxed" || name === "fbox" || name === "mathop") {
      return this.argument()
    }
    if (name === "textcolor" || name === "colorbox") {
      this.rawArgument()
      return this.argument()
    }
    if (name === "mod" || name === "bmod") return sym("mod", "bin")
    if (name === "pmod") return row([sym(" ", "space"), sym("(", "open"), sym("mod", "op"), this.argument(), sym(")", "close")])
    if (WITH_ARGUMENT_IGNORED.has(name)) {
      this.rawArgument()
      return name.startsWith("h") ? sym(" ", "space") : null
    }
    if (IGNORED.has(name)) return null
    if (name === "\\") return null // line break outside a grid
    return sym(`\\${name}`, "op") // unknown: shown verbatim, spaced like a function name
  }
}

const row = (items: MathNode[]): MathNode => ({ t: "row", items })

function hasLimits(node: MathNode): boolean {
  return node.t === "sym" && node.kind === "op" && (node as { limits?: boolean }).limits === true
}

function restyle(node: MathNode, font: Record<string, string>): MathNode {
  switch (node.t) {
    case "sym":
      return { ...node, s: [...node.s].map((c) => font[c] ?? c).join("") }
    case "row":
      return { t: "row", items: node.items.map((n) => restyle(n, font)) }
    case "scripts":
      return { ...node, base: restyle(node.base, font) }
    default:
      return node
  }
}

function parseRow(raw: string): MathNode {
  return new Parser(raw).row()
}

function parseGrid(raw: string, env: string): MathNode {
  const lines = splitTop(raw, "\\\\")
  if (lines.length > 1 && lines[lines.length - 1]!.trim() === "") lines.pop()
  const rows = lines.map((line) =>
    splitTop(line, "&").map((cell, c) => {
      const node = parseRow(cell)
      // "a &= b": the relation after the alignment point still needs its space.
      const first = node.t === "row" ? node.items[0] : node
      const relation = first && (kindOf(first) === "rel" || kindOf(first) === "bin")
      return c > 0 && relation ? row([sym(" ", "space"), node]) : node
    }),
  )
  return { t: "grid", env, rows }
}

export function parseMath(latex: string): MathNode {
  const grid = parseGrid(latex, "gather") as Extract<MathNode, { t: "grid" }>
  if (grid.rows.length === 1 && grid.rows[0]!.length === 1) return grid.rows[0]![0]!
  if (grid.rows.some((r) => r.length > 1)) return { ...grid, env: "aligned" }
  return grid
}

// --- shared spacing ----------------------------------------------------------

function kindOf(node: MathNode): Kind {
  if (node.t === "sym") return node.kind
  if (node.t === "scripts") return kindOf(node.base)
  if (node.t === "row" && node.items.length === 1) return kindOf(node.items[0]!)
  return "ord"
}

/** Interleaves items with spaces around binary operators and relations, like TeX. */
function spaced<T>(items: MathNode[], render: (node: MathNode) => T, space: () => T, script: boolean): T[] {
  const out: T[] = []
  let prev: Kind | undefined
  for (const item of items) {
    let kind = kindOf(item)
    if (kind === "bin" && (prev === undefined || prev === "bin" || prev === "rel" || prev === "open" || prev === "punct" || prev === "op")) {
      kind = "ord" // unary minus/plus
    }
    const gap =
      !script &&
      prev !== undefined &&
      prev !== "space" &&
      kind !== "space" &&
      (kind === "bin" ||
        kind === "rel" ||
        prev === "bin" ||
        prev === "rel" ||
        prev === "punct" ||
        (kind === "op" && (prev === "ord" || prev === "close")) ||
        (prev === "op" && kind !== "open" && kind !== "punct" && kind !== "close"))
    if (gap) out.push(space())
    out.push(render(item))
    prev = kind
  }
  return out
}

// --- inline (linear) rendering ------------------------------------------------

function mapAll(text: string, table: Record<string, string>): string | undefined {
  let out = ""
  for (const c of text) {
    const mapped = table[c]
    if (mapped === undefined) return undefined
    out += mapped
  }
  return out
}

/** Text that reads unambiguously next to an operator without parentheses. */
function isAtomic(text: string): boolean {
  return /^[\p{L}\p{N}.′\p{M}∞]+$/u.test(text) || /^\(.*\)$|^\[.*\]$|^⟨.*⟩$/.test(text)
}

const wrap = (text: string) => (isAtomic(text) ? text : `(${text})`)

function scriptText(text: string, table: Record<string, string>, marker: string): string {
  return mapAll(text, table) ?? `${marker}${[...text].length === 1 ? text : `(${text})`}`
}

function linear(node: MathNode, script = false): string {
  switch (node.t) {
    case "sym":
      return node.s
    case "row":
      return spaced(node.items, (n) => linear(n, script), () => " ", script).join("")
    case "scripts": {
      const base = linear(node.base, script)
      const sub = node.sub ? scriptText(linear(node.sub, true), SUBSCRIPT, "_") : ""
      const sup = node.sup ? scriptText(linear(node.sup, true), SUPERSCRIPT, "^") : ""
      return base + sub + sup
    }
    case "frac": {
      const num = linear(node.num, script)
      const den = linear(node.den, script)
      if (node.binom) return `C(${num}, ${den})`
      return VULGAR_FRACTION[`${num}/${den}`] ?? `${wrap(num)}/${wrap(den)}`
    }
    case "sqrt": {
      const body = wrap(linear(node.body, script))
      const index = node.index ? linear(node.index, true) : ""
      if (index === "3") return `∛${body}`
      if (index === "4") return `∜${body}`
      return (index ? scriptText(index, SUPERSCRIPT, "^") : "") + `√${body}`
    }
    case "accent": {
      const body = linear(node.body, script)
      const chars = [...body]
      if (chars.length === 1 || /^[̲̅]$/.test(node.mark) || node.mark === "̄") {
        return chars.map((c) => c + node.mark).join("")
      }
      return body + node.mark
    }
    case "fenced":
      return node.open + linear(node.body, script) + node.close
    case "grid": {
      const rows = node.rows.map((cells) => cells.map((c) => linear(c, script)).join(node.env.startsWith("align") ? "" : " "))
      const [open, close] = gridDelimiters(node.env)
      if (node.env === "cases") return `{ ${rows.join("; ")}`
      return open + rows.join("; ") + close
    }
  }
}

/** One line of Unicode for inline math. */
export function renderInline(latex: string): string {
  return linear(parseMath(latex))
    .replace(/ {2,}/g, " ")
    .trim()
}

// --- display (2D) rendering ---------------------------------------------------

type Box = { lines: string[]; base: number; width: number }

const width = (text: string) => Bun.stringWidth(text)
const pad = (text: string, w: number) => text + " ".repeat(Math.max(0, w - width(text)))
const center = (text: string, w: number) => {
  const left = Math.floor((w - width(text)) / 2)
  return pad(" ".repeat(Math.max(0, left)) + text, w)
}

function textBox(text: string): Box {
  return { lines: [text], base: 0, width: width(text) }
}

function hcat(boxes: Box[]): Box {
  if (boxes.length === 0) return textBox("")
  const above = Math.max(...boxes.map((b) => b.base))
  const below = Math.max(...boxes.map((b) => b.lines.length - 1 - b.base))
  const lines = Array.from({ length: above + below + 1 }, () => "")
  for (const box of boxes) {
    for (let row = 0; row < lines.length; row++) {
      lines[row] += pad(box.lines[row - (above - box.base)] ?? "", box.width)
    }
  }
  return { lines, base: above, width: boxes.reduce((w, b) => w + b.width, 0) }
}

/** Stacks boxes vertically, centred; `base` is the row (in the result) to use as baseline. */
function vstack(boxes: Box[], base: number): Box {
  const w = Math.max(...boxes.map((b) => b.width))
  return { lines: boxes.flatMap((b) => b.lines.map((l) => center(l, w))), base, width: w }
}

function gridDelimiters(env: string): [string, string] {
  switch (env) {
    case "pmatrix": return ["(", ")"]
    case "bmatrix": return ["[", "]"]
    case "Bmatrix": return ["{", "}"]
    case "vmatrix": return ["|", "|"]
    case "Vmatrix": return ["‖", "‖"]
    case "cases": return ["{", ""]
    default: return ["", ""]
  }
}

function tallDelimiter(delimiter: string, height: number): Box {
  if (!delimiter) return { lines: Array(height).fill(""), base: 0, width: 0 }
  const glyphs = TALL_DELIMITER[delimiter]
  if (height === 1 || !glyphs) return { lines: Array(height).fill(delimiter), base: 0, width: width(delimiter) }
  const [top, middle, bottom, fill] = glyphs
  const mid = Math.floor((height - 1) / 2)
  const lines = Array.from({ length: height }, (_, row) =>
    row === 0 ? top : row === height - 1 ? bottom : row === mid && (delimiter === "{" || delimiter === "}") ? middle : fill,
  )
  return { lines, base: 0, width: 1 }
}

function fence(open: string, body: Box, close: string): Box {
  const h = body.lines.length
  const left = { ...tallDelimiter(open, h), base: body.base }
  const right = { ...tallDelimiter(close, h), base: body.base }
  return hcat([left, body, right])
}

function layout(node: MathNode, script = false): Box {
  switch (node.t) {
    case "sym":
      return textBox(node.s)
    case "row":
      return hcat(spaced(node.items, (n) => layout(n, script), () => textBox(" "), script))
    case "scripts": {
      const base = layout(node.base, script)
      const sup = node.sup && layout(node.sup, true)
      const sub = node.sub && layout(node.sub, true)
      if (node.limits && !script) {
        const parts = [sup, base, sub].filter((b): b is Box => !!b)
        return vstack(parts, (sup ? sup.lines.length : 0) + base.base)
      }
      // Compact Unicode scripts when possible: x², aᵢⱼ.
      const flatSup = sup && sup.lines.length === 1 ? mapAll(sup.lines[0]!, SUPERSCRIPT) : ""
      const flatSub = sub && sub.lines.length === 1 ? mapAll(sub.lines[0]!, SUBSCRIPT) : ""
      if (flatSup !== undefined && flatSub !== undefined) return hcat([base, textBox(flatSub + flatSup)])
      // Raised / lowered boxes to the right of the base.
      const w = Math.max(sup?.width ?? 0, sub?.width ?? 0)
      const supLines = sup ? sup.lines.map((l) => " ".repeat(base.width) + pad(l, w)) : []
      const subLines = sub ? sub.lines.map((l) => " ".repeat(base.width) + pad(l, w)) : []
      const baseLines = base.lines.map((l) => pad(l, base.width) + " ".repeat(w))
      return { lines: [...supLines, ...baseLines, ...subLines], base: supLines.length + base.base, width: base.width + w }
    }
    case "frac": {
      if (script) return textBox(linear(node, true))
      const num = layout(node.num)
      const den = layout(node.den)
      if (node.binom) return fence("(", vstack([num, den], num.lines.length - 1), ")")
      const w = Math.max(num.width, den.width)
      return vstack([num, textBox("─".repeat(w)), den], num.lines.length)
    }
    case "sqrt": {
      const body = layout(node.body, script)
      if (script) return textBox(linear(node, true))
      const h = body.lines.length
      const index = node.index ? linear(node.index, true) : ""
      const sign = index === "3" ? "∛" : index === "4" ? "∜" : "√"
      if (h === 1) {
        return { lines: [" " + "▁".repeat(body.width), sign + body.lines[0]], base: 1, width: body.width + 1 }
      }
      const lines = [" ".repeat(2) + "▁".repeat(body.width), ...body.lines.map((l, row) => (row === h - 1 ? "╲│" : " │") + l)]
      return { lines, base: body.base + 1, width: body.width + 2 }
    }
    case "accent": {
      const body = layout(node.body, script)
      if (body.lines.length === 1) return textBox(linear(node, script))
      return body
    }
    case "fenced":
      return fence(node.open, layout(node.body, script), node.close)
    case "grid": {
      const cells = node.rows.map((cells) => cells.map((c) => layout(c, script)))
      const columns = Math.max(...cells.map((r) => r.length))
      const widths = Array.from({ length: columns }, (_, c) => Math.max(0, ...cells.map((r) => r[c]?.width ?? 0)))
      const aligned = node.env.startsWith("align") || node.env === "eqnarray" || node.env === "split"
      const gap = (c: number) => (c === 0 ? "" : aligned ? (c % 2 === 0 ? "  " : "") : "  ")
      const rows = cells.map((r) =>
        hcat(
          widths.flatMap((w, c) => {
            const cell = r[c] ?? textBox("")
            const lines = cell.lines.map((l) =>
              aligned ? (c % 2 === 0 ? " ".repeat(w - width(l)) + l : pad(l, w)) : node.env === "cases" ? pad(l, w) : center(l, w),
            )
            return [textBox(gap(c)), { lines, base: cell.base, width: w }]
          }),
        ),
      )
      const stacked: Box = {
        lines: rows.flatMap((r) => r.lines),
        base: Math.floor((rows.reduce((n, r) => n + r.lines.length, 0) - 1) / 2),
        width: Math.max(...rows.map((r) => r.width)),
      }
      const [open, close] = gridDelimiters(node.env)
      return open || close ? fence(open, { ...stacked, lines: stacked.lines.map((l) => ` ${pad(l, stacked.width)} `), width: stacked.width + 2 }, close) : stacked
    }
  }
}

/** Display math laid out over several lines. */
export function renderDisplay(latex: string): string[] {
  return layout(parseMath(latex)).lines.map((line) => line.replace(/\s+$/, ""))
}
