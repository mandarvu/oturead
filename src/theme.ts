import { RGBA, SyntaxStyle, type ThemeTokenStyle } from "@opentui/core"
import { existsSync, readdirSync, readFileSync } from "fs"
import { homedir } from "os"
import { basename, join } from "path"
import { BUNDLED_THEMES } from "./themes"

// Theme files use opencode's v1 theme format, so any opencode theme JSON
// (e.g. from ~/.config/opencode/themes) can be dropped in as-is.
type ColorValue = string | number | { dark: string | number; light: string | number }

export type ThemeJson = {
  $schema?: string
  defs?: Record<string, string | number>
  theme: Record<string, ColorValue | undefined>
}

export type Mode = "dark" | "light"

const COLOR_KEYS = [
  "primary",
  "secondary",
  "accent",
  "error",
  "warning",
  "success",
  "info",
  "text",
  "textMuted",
  "background",
  "backgroundPanel",
  "backgroundElement",
  "border",
  "borderActive",
  "borderSubtle",
  "diffAdded",
  "diffRemoved",
  "diffContext",
  "diffAddedBg",
  "diffRemovedBg",
  "diffContextBg",
  "markdownText",
  "markdownHeading",
  "markdownLink",
  "markdownLinkText",
  "markdownCode",
  "markdownBlockQuote",
  "markdownEmph",
  "markdownStrong",
  "markdownHorizontalRule",
  "markdownListItem",
  "markdownListEnumeration",
  "markdownImage",
  "markdownImageText",
  "markdownCodeBlock",
  "syntaxComment",
  "syntaxKeyword",
  "syntaxFunction",
  "syntaxVariable",
  "syntaxString",
  "syntaxNumber",
  "syntaxType",
  "syntaxOperator",
  "syntaxPunctuation",
] as const

export type ColorKey = (typeof COLOR_KEYS)[number]
export type Theme = Record<ColorKey, RGBA>

// xterm 256-colour palette, used for themes that reference ANSI indices.
function ansiToRgba(code: number): RGBA {
  const base16 = [
    "#000000", "#800000", "#008000", "#808000", "#000080", "#800080", "#008080", "#c0c0c0",
    "#808080", "#ff0000", "#00ff00", "#ffff00", "#0000ff", "#ff00ff", "#00ffff", "#ffffff",
  ]
  if (code < 16) return RGBA.fromHex(base16[code]!)
  if (code < 232) {
    const n = code - 16
    const level = (v: number) => (v === 0 ? 0 : 55 + v * 40)
    return RGBA.fromInts(level(Math.floor(n / 36)), level(Math.floor(n / 6) % 6), level(n % 6))
  }
  const gray = 8 + (code - 232) * 10
  return RGBA.fromInts(gray, gray, gray)
}

export function resolveTheme(json: ThemeJson, mode: Mode): Theme {
  const defs = json.defs ?? {}

  function resolve(value: ColorValue | undefined, chain: string[]): RGBA {
    if (value === undefined) return RGBA.fromInts(0, 0, 0, 0)
    if (typeof value === "number") return ansiToRgba(value)
    if (typeof value === "object") return resolve(value[mode], chain)
    if (value === "none" || value === "transparent") return RGBA.fromInts(0, 0, 0, 0)
    if (value.startsWith("#")) return RGBA.fromHex(value)
    if (chain.includes(value)) throw new Error(`circular color reference: ${[...chain, value].join(" -> ")}`)
    const next = defs[value] ?? json.theme[value]
    if (next === undefined) throw new Error(`color reference "${value}" not found`)
    return resolve(next, [...chain, value])
  }

  const out = {} as Theme
  for (const key of COLOR_KEYS) {
    out[key] = resolve(json.theme[key] ?? fallback(key), [key])
  }
  return out
}

function fallback(key: ColorKey): string {
  if (key.startsWith("markdown")) return "markdownText" === key ? "text" : "primary"
  if (key.startsWith("syntax")) return "text"
  if (key.startsWith("diff")) return "textMuted"
  if (key.startsWith("background")) return "background"
  if (key.startsWith("border")) return "border"
  return "text"
}

function userThemeDirs(): string[] {
  const config = process.env.XDG_CONFIG_HOME || join(homedir(), ".config")
  return [join(config, "oturead", "themes"), join(config, "opencode", "themes")]
}

/** Bundled themes plus any *.json themes from ~/.config/{oturead,opencode}/themes. */
export function loadThemes(): Record<string, ThemeJson> {
  const themes: Record<string, ThemeJson> = { ...BUNDLED_THEMES }
  for (const dir of userThemeDirs()) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue
      try {
        themes[basename(file, ".json")] = JSON.parse(readFileSync(join(dir, file), "utf-8"))
      } catch {
        // Ignore malformed user themes rather than refusing to start.
      }
    }
  }
  return themes
}

function rule(scope: string[], foreground: RGBA | undefined, style: Omit<ThemeTokenStyle["style"], "foreground"> = {}) {
  return { scope, style: foreground ? { foreground, ...style } : style } satisfies ThemeTokenStyle
}

/**
 * Tree-sitter capture -> style rules. Mirrors opencode's TUI syntax table, with
 * per-level heading colours so sections and subsections stand apart.
 */
export function generateSyntax(t: Theme): SyntaxStyle {
  return SyntaxStyle.fromTheme([
    rule(["default"], t.text),
    rule(["conceal"], t.border),
    rule(["comment", "comment.documentation"], t.syntaxComment, { italic: true }),
    rule(["string", "symbol", "character.special", "character"], t.syntaxString),
    rule(["number", "boolean", "constant", "float"], t.syntaxNumber),
    rule(["keyword.return", "keyword.conditional", "keyword.repeat", "keyword.coroutine"], t.syntaxKeyword, {
      italic: true,
    }),
    rule(["keyword.type"], t.syntaxType, { bold: true, italic: true }),
    rule(["keyword.function", "function.method"], t.syntaxFunction),
    rule(["keyword"], t.syntaxKeyword, { italic: true }),
    rule(["keyword.import", "string.escape", "string.regexp", "tag.attribute", "keyword.export"], t.syntaxKeyword),
    rule(["operator", "keyword.operator", "punctuation.delimiter", "keyword.conditional.ternary"], t.syntaxOperator),
    rule(
      ["variable", "variable.parameter", "function.method.call", "function.call", "property", "parameter", "field"],
      t.syntaxVariable,
    ),
    rule(["variable.member", "function", "constructor"], t.syntaxFunction),
    rule(["type", "module", "class", "namespace"], t.syntaxType),
    rule(["type.definition"], t.syntaxType, { bold: true }),
    rule(["punctuation", "punctuation.bracket"], t.syntaxPunctuation),
    rule(
      ["variable.builtin", "type.builtin", "function.builtin", "module.builtin", "constant.builtin", "variable.super"],
      t.error,
    ),
    rule(["keyword.directive", "keyword.modifier", "keyword.exception"], t.syntaxKeyword, { italic: true }),
    rule(["punctuation.special", "tag.delimiter"], t.syntaxOperator),

    // Markdown structure
    rule(["markup.heading"], t.markdownHeading, { bold: true }),
    rule(["markup.heading.1"], t.markdownHeading, { bold: true, underline: true }),
    rule(["markup.heading.2"], t.primary, { bold: true }),
    rule(["markup.heading.3"], t.secondary, { bold: true }),
    rule(["markup.heading.4"], t.info, { bold: true }),
    rule(["markup.heading.5"], t.markdownHeading, { bold: true, italic: true }),
    rule(["markup.heading.6"], t.textMuted, { bold: true, italic: true }),
    rule(["markup.bold", "markup.strong"], t.markdownStrong, { bold: true }),
    rule(["markup.italic"], t.markdownEmph, { italic: true }),
    rule(["markup.list"], t.markdownListItem),
    rule(["markup.list.numbered"], t.markdownListEnumeration),
    rule(["markup.quote"], t.markdownBlockQuote, { italic: true }),
    rule(["markup.raw", "markup.raw.block"], t.markdownCode),
    rule(["markup.raw.inline"], t.markdownCode, { background: t.backgroundElement }),
    rule(["markup.link", "markup.link.url", "string.special", "string.special.url"], t.markdownLink, {
      underline: true,
    }),
    rule(["markup.link.label"], t.markdownLinkText, { underline: true }),
    rule(["label"], t.markdownLinkText),
    rule(["spell", "nospell"], t.text),
    // No foreground: underline/highlight layer on top of whatever else applies (bold, italic, ...).
    rule(["markup.underline"], undefined, { underline: true }),
    rule(["markup.highlight"], t.background, { background: t.markdownEmph, bold: true }),
    rule(["comment.error"], t.error, { italic: true, bold: true }),
    rule(["comment.warning"], t.warning, { italic: true, bold: true }),
    rule(["comment.todo", "comment.note"], t.info, { italic: true, bold: true }),
    rule(["attribute", "annotation"], t.warning),
    rule(["tag"], t.error),
    rule(["markup.strikethrough", "markup.list.unchecked", "debug"], t.textMuted),
    rule(["markup.list.checked"], t.success),
    rule(["diff.plus"], t.diffAdded, { background: t.diffAddedBg }),
    rule(["diff.minus"], t.diffRemoved, { background: t.diffRemovedBg }),
    rule(["diff.delta"], t.diffContext, { background: t.diffContextBg }),
    rule(["error"], t.error, { bold: true }),
    rule(["warning"], t.warning, { bold: true }),
    rule(["info"], t.info),
  ])
}
