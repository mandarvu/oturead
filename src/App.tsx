import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useKeyboard, useRenderer, useSelectionHandler, useTerminalDimensions } from "@opentui/react"
import type { MarkdownRenderable, ScrollBoxRenderable } from "@opentui/core"
import { generateSyntax, resolveTheme, type Mode, type ThemeJson } from "./theme"
import { openInEditor } from "./editor"
import { followLine, lineAtRow, locateBlocks, rowOfLine, type BlockSpan } from "./position"
import { leadingBlocks } from "./progressive"
import { ThemePicker } from "./ThemePicker"
import type { Source } from "./source"

interface AppProps {
  source: Source
  themes: Record<string, ThemeJson>
  initialTheme: string
  initialMode: Mode
  onExit: () => void
}

type Heading = { level: number; text: string; offset: number }

const HELP: [string, string][] = [
  ["j / k  ↓ / ↑", "scroll line"],
  ["d / u  ^d / ^u", "half page"],
  ["space / b  PgDn / PgUp", "full page"],
  ["g / G  Home / End", "top / bottom"],
  ["] / [  n / p", "next / previous heading"],
  ["e", "edit in $EDITOR at this line"],
  ["t", "pick theme (fuzzy search)"],
  ["m", "toggle dark / light"],
  ["r", "toggle rendered / raw markdown"],
  ["mouse drag", "select & copy (OSC 52)"],
  ["?", "toggle this help"],
  ["q  ^c", "quit"],
]

function plainHeading(text: string) {
  return text
    .replace(/<\/?[a-z]+>/gi, "")
    .replace(/[*_`~=]+/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .trim()
}

export function App({ source, themes, initialTheme, initialMode, onExit }: AppProps) {
  const renderer = useRenderer()
  const { width, height } = useTerminalDimensions()
  const doc = useSyncExternalStore(source.subscribe, source.get)

  // Large documents: build the first few screens, paint them, then the rest.
  const [progressive, setProgressive] = useState(true)
  useEffect(() => {
    const done = () => setProgressive(false)
    renderer.once("frame", done)
    return () => {
      renderer.off("frame", done)
    }
  }, [renderer])
  const content = progressive && !doc.streaming ? leadingBlocks(doc.content, height * 2) : doc.content
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  const markdownRef = useRef<MarkdownRenderable>(null)

  const themeNames = useMemo(() => Object.keys(themes).sort(), [themes])
  const [themeName, setThemeName] = useState(themes[initialTheme] ? initialTheme : "opencode")
  const [mode, setMode] = useState<Mode>(initialMode)
  const [conceal, setConceal] = useState(true)
  const [showHelp, setShowHelp] = useState(false)
  const [pickerOrigin, setPickerOrigin] = useState<string>() // theme to restore if the picker is cancelled
  const [scrollPct, setScrollPct] = useState(0)
  const [section, setSection] = useState<Heading[]>([])
  const [toast, setToast] = useState<string>()
  const savedScroll = useRef<number | undefined>(undefined)

  // A malformed (user) theme falls back to opencode instead of crashing the UI.
  const resolved = useMemo(() => {
    try {
      return { theme: resolveTheme(themes[themeName]!, mode) }
    } catch (err: any) {
      return { theme: resolveTheme(themes.opencode!, mode), error: `theme ${themeName}: ${err.message}` }
    }
  }, [themes, themeName, mode])
  const theme = resolved.theme
  useEffect(() => {
    if (resolved.error) setToast(resolved.error)
  }, [resolved])
  const syntax = useMemo(() => generateSyntax(theme), [theme])
  useEffect(() => () => syntax.destroy(), [syntax])

  useEffect(() => {
    renderer.setBackgroundColor(theme.background)
  }, [renderer, theme])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(undefined), 1500)
    return () => clearTimeout(timer)
  }, [toast])

  // Top-level markdown blocks are separate renderables, so headings can be
  // located by walking the block list and measuring their positions.
  const headings = useCallback((): Heading[] => {
    const md = markdownRef.current as any
    const box = scrollRef.current
    if (!md || !box) return []
    const base = box.content.y
    const out: Heading[] = []
    for (const state of md._blockStates ?? []) {
      if (state.token?.type !== "heading") continue
      out.push({ level: state.token.depth, text: plainHeading(state.token.text), offset: state.renderable.y - base })
    }
    return out
  }, [])

  // Source line + rendered position of every top-level block.
  const blockSpans = useCallback((): BlockSpan[] => {
    const md = markdownRef.current as any
    const box = scrollRef.current
    if (!md || !box) return []
    const states: any[] = md._blockStates ?? []
    const located = locateBlocks(md.content, states.map((state) => state.tokenRaw ?? state.token?.raw ?? ""))
    const base = box.content.y
    return states.map((state, i) => ({
      ...located[i]!,
      offset: state.renderable.y - base,
      height: Math.max(1, state.renderable.height),
    }))
  }, [])

  const refreshStatus = useCallback(() => {
    const box = scrollRef.current
    if (!box) return
    const maxScroll = box.scrollHeight - box.viewport.height
    setScrollPct(maxScroll <= 0 ? 100 : Math.min(100, Math.round((box.scrollTop / maxScroll) * 100)))

    // Breadcrumb of the section containing the top of the viewport.
    const trail: Heading[] = []
    for (const heading of headings()) {
      if (heading.offset > box.scrollTop + 1) break
      while (trail.length && trail[trail.length - 1]!.level >= heading.level) trail.pop()
      trail.push(heading)
    }
    setSection(trail)
  }, [headings])

  useEffect(() => {
    const box = scrollRef.current
    if (!box) return
    box.verticalScrollBar.on("change", refreshStatus)
    return () => {
      box.verticalScrollBar.off("change", refreshStatus)
    }
  }, [refreshStatus])

  // Re-measure once layout settles after content/theme/size changes.
  useEffect(() => {
    const timer = setTimeout(refreshStatus, 30)
    return () => clearTimeout(timer)
  }, [doc, themeName, mode, conceal, width, height, refreshStatus])

  // Open the file in $EDITOR at the line at the top of the viewport, then come
  // back to that line once the editor exits.
  const returnTo = useRef<{ line: number; content: string } | undefined>(undefined)
  const editAtViewport = () => {
    if (!source.path || !source.reload) return setToast("nothing to edit: not reading from a file")
    const box = scrollRef.current
    const line = box ? lineAtRow(blockSpans(), box.scrollTop) : 0
    renderer.suspend()
    let error: string | undefined
    try {
      error = openInEditor(source.path, line + 1)
    } finally {
      renderer.resume()
    }
    if (error) setToast(error)
    returnTo.current = { line, content: doc.content }
    source.reload()
  }

  useEffect(() => {
    const target = returnTo.current
    if (!target) return
    returnTo.current = undefined
    if (target.content === doc.content) return // unchanged: we're already there
    const line = followLine(target.content, doc.content, target.line)
    const restore = () => {
      scrollRef.current?.scrollTo(rowOfLine(blockSpans(), line))
      refreshStatus()
    }
    // Block positions are only final once the new content has been laid out.
    renderer.once("frame", restore)
    return () => {
      renderer.off("frame", restore)
    }
  }, [doc, renderer, blockSpans, refreshStatus])

  useSelectionHandler((selection) => {
    if (selection.isDragging) return
    const text = selection.getSelectedText()
    if (!text) return
    if (renderer.copyToClipboardOSC52(text)) setToast(`copied ${text.length} chars`)
  })

  const jumpHeading = (direction: 1 | -1) => {
    const box = scrollRef.current
    if (!box) return
    const list = headings()
    const current = box.scrollTop
    const target =
      direction === 1
        ? list.find((h) => h.offset > current + 1)
        : [...list].reverse().find((h) => h.offset < current - 1)
    if (target) box.scrollTo(Math.max(0, target.offset - 1))
    else box.scrollTo(direction === 1 ? box.scrollHeight : 0)
  }

  // OpenTUI doesn't restyle nested list items when the syntax style changes, so
  // style changes remount the markdown; remember where we were to restore it.
  const restyle = useCallback((apply: () => void) => {
    const box = scrollRef.current
    if (box && box.scrollHeight > 0) savedScroll.current = box.scrollTop / box.scrollHeight
    apply()
  }, [])

  useEffect(() => {
    const ratio = savedScroll.current
    if (ratio === undefined) return
    savedScroll.current = undefined
    const timer = setTimeout(() => {
      const box = scrollRef.current
      if (box) box.scrollTo(Math.round(ratio * box.scrollHeight))
      refreshStatus()
    }, 50)
    return () => clearTimeout(timer)
  }, [themeName, mode, conceal, refreshStatus])

  const themeNameRef = useRef(themeName)
  themeNameRef.current = themeName
  const applyTheme = useCallback(
    (name: string) => {
      if (name !== themeNameRef.current) restyle(() => setThemeName(name))
    },
    [restyle],
  )

  useKeyboard((key) => {
    const box = scrollRef.current
    const seq = key.sequence
    if (key.ctrl && key.name === "c") return onExit()
    if (pickerOrigin !== undefined) return // the picker handles its own keys
    if (key.name === "q") return onExit()
    if (key.name === "escape" && showHelp) return setShowHelp(false)
    if (seq === "?") return setShowHelp((v) => !v)
    if (key.name === "t") return setPickerOrigin(themeName)
    if (key.name === "e") return editAtViewport()
    if (key.name === "m") return restyle(() => setMode((m) => (m === "dark" ? "light" : "dark")))
    if (key.name === "r") return restyle(() => setConceal((c) => !c))
    if (!box) return

    const page = box.viewport.height
    if (key.name === "j" || key.name === "down") box.scrollBy(1)
    else if (key.name === "k" || key.name === "up") box.scrollBy(-1)
    else if (key.name === "d") box.scrollBy(Math.floor(page / 2))
    else if (key.name === "u") box.scrollBy(-Math.floor(page / 2))
    else if (key.name === "space" || key.name === "f" || key.name === "pagedown") box.scrollBy(page - 2)
    else if (key.name === "b" || key.name === "pageup") box.scrollBy(-(page - 2))
    else if (seq === "G" || key.name === "end") box.scrollTo(box.scrollHeight)
    else if (key.name === "g" || key.name === "home") box.scrollTo(0)
    else if (seq === "]" || key.name === "n") jumpHeading(1)
    else if (seq === "[" || key.name === "p") jumpHeading(-1)
    else return
    refreshStatus()
  })

  const crumb = section.map((h) => h.text).join(" › ")
  const status = doc.streaming ? "● streaming" : `${scrollPct}%`

  return (
    <box width={width} height={height} flexDirection="column" backgroundColor={theme.background}>
      <box height={1} flexDirection="row" paddingX={1} backgroundColor={theme.backgroundPanel}>
        <text fg={theme.primary} flexShrink={0}>
          <b>{source.title}</b>
        </text>
        <box flexGrow={1} flexShrink={1} paddingX={2} overflow="hidden">
          <text fg={theme.textMuted} wrapMode="none">
            {crumb ? `› ${crumb}` : ""}
          </text>
        </box>
        <text fg={theme.textMuted} flexShrink={0}>
          {themeName} · {mode}
          {conceal ? "" : " · raw"}
        </text>
      </box>

      <scrollbox
        ref={scrollRef}
        // Keys are handled globally below. If the scrollbox could take focus (the
        // renderer focuses on click), its own j/k/PgUp/... handling would run as well
        // and every keypress would scroll twice.
        focusable={false}
        flexGrow={1}
        scrollY
        scrollX={false}
        stickyScroll={doc.streaming}
        stickyStart="bottom"
        viewportOptions={{ paddingRight: 1 }}
        verticalScrollbarOptions={{
          paddingLeft: 1,
          trackOptions: {
            backgroundColor: theme.backgroundElement,
            foregroundColor: theme.border,
          },
        }}
      >
        <markdown
          key={`${themeName}:${mode}:${conceal}`}
          ref={markdownRef}
          content={content}
          syntaxStyle={syntax}
          streaming={doc.streaming}
          internalBlockMode="top-level"
          tableOptions={{ style: "grid", cellPaddingX: 1, borderColor: theme.border }}
          conceal={conceal}
          fg={theme.markdownText}
          bg={theme.background}
          paddingX={2}
          paddingTop={1}
          paddingBottom={1}
        />
      </scrollbox>

      <box height={1} flexDirection="row" paddingX={1} backgroundColor={theme.backgroundPanel}>
        <text fg={doc.streaming ? theme.success : theme.textMuted} flexShrink={0}>
          {status}
        </text>
        <box flexGrow={1} flexShrink={1} paddingX={2} overflow="hidden">
          <text fg={theme.warning} wrapMode="none">
            {toast ?? ""}
          </text>
        </box>
        <text fg={theme.textMuted} flexShrink={0}>
          ? help · ]/[ sections · e edit · t theme · q quit
        </text>
      </box>

      {pickerOrigin !== undefined && (
        <ThemePicker
          names={themeNames}
          current={pickerOrigin}
          theme={theme}
          width={width}
          height={height}
          onPreview={applyTheme}
          onSelect={(name) => {
            applyTheme(name)
            setPickerOrigin(undefined)
            setToast(`theme: ${name}`)
          }}
          onCancel={() => {
            applyTheme(pickerOrigin)
            setPickerOrigin(undefined)
          }}
        />
      )}

      {showHelp && (
        <box
          position="absolute"
          top={Math.max(1, Math.floor((height - HELP.length - 4) / 2))}
          left={Math.max(0, Math.floor((width - 60) / 2))}
          width={Math.min(60, width)}
          border
          borderStyle="rounded"
          borderColor={theme.borderActive}
          backgroundColor={theme.backgroundPanel}
          title=" keys "
          titleAlignment="center"
          flexDirection="column"
          paddingX={1}
        >
          {HELP.map(([keys, action]) => (
            <box key={keys} flexDirection="row" backgroundColor={theme.backgroundPanel}>
              <text fg={theme.accent} width={24} flexShrink={0}>
                {keys}
              </text>
              <text fg={theme.text}>{action}</text>
            </box>
          ))}
        </box>
      )}
    </box>
  )
}
