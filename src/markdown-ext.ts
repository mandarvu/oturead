import { MarkdownRenderable, StyledText, TextAttributes, TextRenderable } from "@opentui/core"

// OpenTUI's MarkdownRenderable is what opencode uses to render assistant
// messages. It covers CommonMark/GFM, but a few things a document reader wants
// are missing, so we extend it here by wrapping a handful of its (TS-private,
// JS-visible) prototype methods:
//
//  * underline via <u>/<ins>, highlight via ==text== or <mark>
//  * nicer list markers: per-depth bullets, ☐/☑ task checkboxes, coloured numbers
//  * blockquote bar tinted with the quote colour
//
// Everything here is additive: each wrapper calls the original first.

type Highlight = [number, number, string, Record<string, unknown>?]
type Chunk = { text: string; fg?: unknown; bg?: unknown; attributes?: number }
type ListInput = { item: any; marker: string; markerWidth: number; id: string; group?: string }

const proto = MarkdownRenderable.prototype as any

const INLINE_RULES: { re: RegExp; group: string }[] = [
  { re: /<(u|ins)>([\s\S]+?)<\/\1>/g, group: "markup.underline" },
  { re: /<(mark)>([\s\S]+?)<\/\1>/g, group: "markup.highlight" },
  { re: /(==)(?=\S)([\s\S]+?)(?<=\S)==(?!=)/g, group: "markup.highlight" },
]

const BULLETS = ["•", "◦", "▸"]

// --- underline / highlight in tree-sitter rendered prose -------------------

const origAddHighlights = proto.addMarkdownLinkHighlights
proto.addMarkdownLinkHighlights = function (highlights: Highlight[], content: string): Highlight[] {
  const result: Highlight[] = origAddHighlights.call(this, highlights, content)
  if (!/<(u|ins|mark)>|==/.test(content)) return result

  // Never style inside code spans/blocks.
  const raw = result.filter(([s, e, g]) => g.startsWith("markup.raw") && e > s)
  const inRaw = (pos: number) => raw.some(([s, e]) => pos >= s && pos < e)

  const extra: Highlight[] = []
  for (const { re, group } of INLINE_RULES) {
    re.lastIndex = 0
    for (let m = re.exec(content); m; m = re.exec(content)) {
      if (inRaw(m.index)) continue
      const open = m[1] === "==" ? 2 : m[1]!.length + 2
      const close = m[1] === "==" ? 2 : m[1]!.length + 3
      const start = m.index
      const end = start + m[0].length
      // "conceal.tag" rather than "conceal": OpenTUI eats the space after a plain "conceal" range.
      extra.push([start, start + open, "conceal.tag", { conceal: "" }])
      extra.push([start + open, end - close, group])
      extra.push([end - close, end, "conceal.tag", { conceal: "" }])
    }
  }
  return extra.length ? [...result, ...extra] : result
}

// --- underline / highlight in tables and streaming previews ---------------
// These paths render marked's inline tokens directly instead of tree-sitter.

const TAG_RE = /^<(\/?)(u|ins|mark)\s*>$/i

const origRenderInlineContent = proto.renderInlineContent
proto.renderInlineContent = function (tokens: any[], chunks: Chunk[], link?: unknown) {
  if (!tokens.some((t) => t.type === "html" || (t.type === "text" && t.text.includes("==")))) {
    return origRenderInlineContent.call(this, tokens, chunks, link)
  }
  let underline = 0
  let mark = 0
  const markStyle = this.getStyle("markup.highlight")
  const decorate = (from: number) => {
    for (let i = from; i < chunks.length; i++) {
      const chunk = chunks[i]!
      if (underline) chunk.attributes = (chunk.attributes ?? 0) | TextAttributes.UNDERLINE
      if (mark && markStyle) {
        chunk.fg = markStyle.fg ?? chunk.fg
        chunk.bg = markStyle.bg ?? chunk.bg
        if (markStyle.bold) chunk.attributes = (chunk.attributes ?? 0) | TextAttributes.BOLD
      }
    }
  }

  for (const token of tokens) {
    const tag = token.type === "html" ? TAG_RE.exec(token.raw.trim()) : null
    if (tag) {
      const delta = tag[1] ? -1 : 1
      if (tag[2]!.toLowerCase() === "mark") mark = Math.max(0, mark + delta)
      else underline = Math.max(0, underline + delta)
      if (!this._conceal) chunks.push(this.createChunk(token.raw, "tag", link))
      continue
    }
    if (token.type === "text" && token.text.includes("==")) {
      const parts = token.text.split(/(==(?=\S)[\s\S]+?(?<=\S)==)/)
      for (const part of parts) {
        if (!part) continue
        const before = chunks.length
        const isMark = part.length > 4 && part.startsWith("==") && part.endsWith("==")
        const text = isMark && this._conceal ? part.slice(2, -2) : part
        chunks.push(this.createChunk(text, "default", link))
        if (isMark) mark++
        decorate(before)
        if (isMark) mark--
      }
      continue
    }
    const before = chunks.length
    this.renderInlineToken(token, chunks, link)
    decorate(before)
  }
}

// --- list markers ----------------------------------------------------------

function markerGroup(token: any, item: any): string {
  if (item.task) return item.checked ? "markup.list.checked" : "markup.list.unchecked"
  return token.ordered ? "markup.list.numbered" : "markup.list"
}

const origGetListItemInputs = proto.getListItemInputs
proto.getListItemInputs = function (token: any, id: string): ListInput[] {
  const inputs: ListInput[] = origGetListItemInputs.call(this, token, id)
  const depth = (id.match(/-item-\d+/g) ?? []).length
  for (const input of inputs) {
    if (input.item.task) input.marker = input.item.checked ? "☑" : "☐"
    else if (!token.ordered) input.marker = BULLETS[depth % BULLETS.length]!
    input.group = markerGroup(token, input.item)
  }
  const width = Math.max(1, ...inputs.map((i) => i.marker.length))
  for (const input of inputs) input.markerWidth = width
  return inputs
}

function restyleMarker(self: any, row: any, input: ListInput) {
  const marker = row?.getChildren?.()[0]
  if (!(marker instanceof TextRenderable) || !input.group) return
  const text = input.marker.padStart(input.markerWidth) + " "
  marker.content = new StyledText([self.createChunk(text, input.group)])
}

const origCreateListItem = proto.createListItemRenderable
proto.createListItemRenderable = function (input: ListInput) {
  const row = origCreateListItem.call(this, input)
  restyleMarker(this, row, input)
  return row
}

const origApplyListItemMarker = proto.applyListItemMarker
proto.applyListItemMarker = function (row: any, input: ListInput) {
  origApplyListItemMarker.call(this, row, input)
  restyleMarker(this, row, input)
}

// --- blockquotes -----------------------------------------------------------

const origQuoteBorder = proto.getBlockquoteBorderColor
proto.getBlockquoteBorderColor = function () {
  return this.getStyle("markup.quote")?.fg ?? origQuoteBorder.call(this)
}
