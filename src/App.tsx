import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import { useKeyboard, useRenderer, useSelectionHandler, useTerminalDimensions } from "@opentui/react"
import type { MarkdownRenderable, ScrollBoxRenderable } from "@opentui/core"
import { generateSyntax, resolveTheme, type Mode, type ThemeJson } from "./theme"
import { openInEditor } from "./editor"
import { foldMarkdown } from "./fold"
import { createImageBlock, type ImageOptions } from "./image-block"
import { standaloneImage } from "./images"
import { renderMathInMarkdown } from "./math/markdown"
import { ancestry, parseOutline, sectionAt, type Section } from "./outline"
import { followLine, lineAtRow, locateBlocks, rowOfLine, type BlockSpan } from "./position"
import { leadingBlocks } from "./progressive"
import { ThemePicker } from "./ThemePicker"
import { Toc, visibleSections } from "./Toc"
import type { Source } from "./source"

interface AppProps {
  source: Source
  themes: Record<string, ThemeJson>
  initialTheme: string
  initialMode: Mode
  /** Image loading; without it, images show as their alt text. */
  images?: ImageOptions
  onExit: () => void
}

const HELP: [string, string][] = [
  ["j / k  ↓ / ↑", "scroll line"],
  ["d / u  ^d / ^u", "half page"],
  ["space / b  PgDn / PgUp", "full page"],
  ["g / G  Home / End", "top / bottom"],
  ["] / [  n / p", "next / previous heading"],
  ["o", "show / hide table of contents"],
  ["tab", "focus contents: ↑↓ space enter h l esc"],
  ["z", "fold / unfold this section"],
  ["1-6 / 0", "fold to depth N / unfold all"],
  ["Z", "fold all / unfold all"],
  ["e", "edit in $EDITOR at this line"],
  ["t", "pick theme (fuzzy search)"],
  ["m", "toggle dark / light"],
  ["r", "toggle rendered / raw markdown"],
  ["mouse drag", "select & copy (OSC 52)"],
  ["?", "toggle this help"],
  ["q  ^c", "quit"],
]

/** Shallowest outline depth with more than one section: "fold all" folds there. */
function overviewDepth(outline: Section[]): number {
  for (let depth = 1; depth <= 6; depth++) {
    if (outline.filter((s) => s.depth === depth).length > 1) return depth
  }
  return 1
}

export function App({ source, themes, initialTheme, initialMode, images, onExit }: AppProps) {
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

  const [conceal, setConceal] = useState(true) // false: show raw markdown

  // Collapsed sections are removed from the markdown before rendering.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const outline = useMemo(() => parseOutline(doc.content), [doc.content])
  const folded = useMemo(() => foldMarkdown(doc.content, outline, collapsed), [doc.content, outline, collapsed])
  // Ids of sections that no longer exist (after an edit) don't count.
  const foldCount = useMemo(() => outline.filter((s) => s.hasBody && collapsed.has(s.id)).length, [outline, collapsed])
  // Then LaTeX math is rendered to Unicode (raw mode shows the LaTeX).
  const rendered = useMemo(() => {
    if (!conceal) return folded
    const math = renderMathInMarkdown(folded.content)
    return { content: math.content, toSource: (line: number) => folded.toSource(math.toSource(line)) }
  }, [folded, conceal])
  const renderedRef = useRef(rendered)
  renderedRef.current = rendered
  const content = progressive && !doc.streaming ? leadingBlocks(rendered.content, height * 2) : rendered.content
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  const markdownRef = useRef<MarkdownRenderable>(null)

  const themeNames = useMemo(() => Object.keys(themes).sort(), [themes])
  const [themeName, setThemeName] = useState(themes[initialTheme] ? initialTheme : "opencode")
  const [mode, setMode] = useState<Mode>(initialMode)
  const [showHelp, setShowHelp] = useState(false)
  const [pickerOrigin, setPickerOrigin] = useState<string>() // theme to restore if the picker is cancelled
  const [scrollPct, setScrollPct] = useState(0)
  const [currentLine, setCurrentLine] = useState(0) // source line at the top of the viewport
  const [tocPreference, setTocPreference] = useState<boolean>() // unset: shown when the terminal is wide
  const [tocCursor, setTocCursor] = useState<number>() // set while the table of contents has focus
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

  // Images that stand on their own line become image blocks (raw mode shows the markdown).
  const renderNode = useMemo(() => {
    if (!images || !conceal) return undefined
    return (token: unknown) => {
      const image = standaloneImage(token)
      return image ? createImageBlock(renderer, image, images, theme) : null
    }
  }, [images, conceal, renderer, theme])
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
  const headingOffsets = useCallback((): number[] => {
    const md = markdownRef.current as any
    const box = scrollRef.current
    if (!md || !box) return []
    const base = box.content.y
    return (md._blockStates ?? [])
      .filter((state: any) => state.token?.type === "heading")
      .map((state: any) => state.renderable.y - base)
  }, [])

  // Source line + rendered position of every top-level block. Lines are in
  // the original document, mapped back through any folding.
  const blockSpans = useCallback((): BlockSpan[] => {
    const md = markdownRef.current as any
    const box = scrollRef.current
    if (!md || !box) return []
    const states: any[] = md._blockStates ?? []
    const located = locateBlocks(md.content, states.map((state) => state.tokenRaw ?? state.token?.raw ?? ""))
    const base = box.content.y
    return states.map((state, i) => ({
      line: renderedRef.current.toSource(located[i]!.line),
      lines: located[i]!.lines,
      offset: state.renderable.y - base,
      height: Math.max(1, state.renderable.height),
    }))
  }, [])

  const refreshStatus = useCallback(() => {
    const box = scrollRef.current
    if (!box) return
    const maxScroll = box.scrollHeight - box.viewport.height
    setScrollPct(maxScroll <= 0 ? 100 : Math.min(100, Math.round((box.scrollTop / maxScroll) * 100)))

    setCurrentLine(lineAtRow(blockSpans(), box.scrollTop))
  }, [blockSpans])

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
  }, [content, themeName, mode, conceal, width, height, refreshStatus])

  // Scroll to a source line once the next content change has been laid out
  // (block positions are only final then). `heading` leaves a row of context.
  const pendingScroll = useRef<{ line: number; heading: boolean } | undefined>(undefined)
  useEffect(() => {
    const target = pendingScroll.current
    if (!target) return
    pendingScroll.current = undefined
    const restore = () => {
      const row = rowOfLine(blockSpans(), target.line)
      scrollRef.current?.scrollTo(Math.max(0, target.heading ? row - 1 : row))
      refreshStatus()
    }
    renderer.once("frame", restore)
    return () => {
      renderer.off("frame", restore)
    }
  }, [content, renderer, blockSpans, refreshStatus])

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
    pendingScroll.current = { line: followLine(target.content, doc.content, target.line), heading: false }
  }, [doc])

  // --- folding ---------------------------------------------------------------

  const setFolds = (next: Set<string>, anchor: { line: number; heading: boolean }) => {
    if (next.size === collapsed.size && [...next].every((id) => collapsed.has(id))) return
    pendingScroll.current = anchor
    setCollapsed(next)
  }

  /** Folds or unfolds the section at index `i` and puts its heading at the top. */
  const toggleSection = (i: number) => {
    const section = outline[i]
    if (!section?.hasBody) return
    const next = new Set(collapsed)
    if (!next.delete(section.id)) next.add(section.id)
    setFolds(next, { line: section.line, heading: true })
  }

  const toggleCurrentSection = () => {
    let i = sectionAt(outline, currentLine)
    while (i >= 0 && !outline[i]!.hasBody) i = outline[i]!.parent ?? -1
    if (i < 0) return setToast("no section here to fold")
    toggleSection(i)
  }

  /** Collapses every section at outline depth `depth`, keeping the reader in their section. */
  const foldToDepth = (depth: number) => {
    const next = new Set(outline.filter((s) => s.depth === depth && s.hasBody).map((s) => s.id))
    const here = ancestry(outline, sectionAt(outline, currentLine))
    const anchor = here.find((i) => outline[i]!.depth === depth)
    setFolds(next, anchor === undefined ? { line: currentLine, heading: false } : { line: outline[anchor]!.line, heading: true })
    setToast(next.size ? `folded to depth ${depth}` : "nothing to fold")
  }

  const unfoldAll = () => setFolds(new Set(), { line: currentLine, heading: false })

  useSelectionHandler((selection) => {
    if (selection.isDragging) return
    const text = selection.getSelectedText()
    if (!text) return
    if (renderer.copyToClipboardOSC52(text)) setToast(`copied ${text.length} chars`)
  })

  // --- table of contents -----------------------------------------------------

  const showToc = (tocPreference ?? width >= 100) && outline.length > 0
  const tocWidth = Math.min(36, Math.max(22, Math.floor(width * 0.24)))
  const activeSection = sectionAt(outline, currentLine)
  const tocFocused = showToc && tocCursor !== undefined

  const jumpToSection = (i: number) => {
    const box = scrollRef.current
    const section = outline[i]
    if (!box || !section) return
    box.scrollTo(Math.max(0, rowOfLine(blockSpans(), section.line) - 1))
    refreshStatus()
  }

  const focusToc = () => {
    const visible = visibleSections(outline, collapsed)
    setTocCursor(visible.includes(activeSection) ? activeSection : visible[0])
  }

  /** Keys while the table of contents has focus; returns false to fall through to the global keys. */
  const handleTocKey = (name: string, seq: string): boolean => {
    const visible = visibleSections(outline, collapsed)
    const cursor = tocCursor !== undefined && visible.includes(tocCursor) ? tocCursor : visible[0]
    if (cursor === undefined) return false
    const section = outline[cursor]!
    const folded = section.hasBody && collapsed.has(section.id)
    const moveTo = (i: number | undefined) => {
      if (i === undefined) return
      setTocCursor(i)
      jumpToSection(i)
    }
    const position = visible.indexOf(cursor)

    if (name === "escape" || name === "tab") setTocCursor(undefined)
    else if (name === "j" || name === "down") moveTo(visible[Math.min(visible.length - 1, position + 1)])
    else if (name === "k" || name === "up") moveTo(visible[Math.max(0, position - 1)])
    else if (name === "g" || name === "home") moveTo(visible[0])
    else if (seq === "G" || name === "end") moveTo(visible[visible.length - 1])
    else if (name === "space" || seq === "z") toggleSection(cursor)
    else if (name === "h" || name === "left") {
      if (section.hasBody && !folded) toggleSection(cursor)
      else moveTo(section.parent)
    } else if (name === "l" || name === "right") {
      if (folded) toggleSection(cursor)
    } else if (name === "return") {
      if (folded) toggleSection(cursor)
      else jumpToSection(cursor)
      setTocCursor(undefined)
    } else return false
    return true
  }

  const jumpHeading = (direction: 1 | -1) => {
    const box = scrollRef.current
    if (!box) return
    const offsets = headingOffsets()
    const current = box.scrollTop
    const target =
      direction === 1
        ? offsets.find((offset) => offset > current + 1)
        : [...offsets].reverse().find((offset) => offset < current - 1)
    if (target !== undefined) box.scrollTo(Math.max(0, target - 1))
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
    if (tocFocused && handleTocKey(key.name, seq)) return
    if (seq === "o") {
      if (showToc) setTocCursor(undefined)
      return setTocPreference(!showToc)
    }
    if (key.name === "tab" && showToc) return focusToc()
    if (seq === "?") return setShowHelp((v) => !v)
    if (key.name === "t") return setPickerOrigin(themeName)
    if (key.name === "e") return editAtViewport()
    if (key.name === "m") return restyle(() => setMode((m) => (m === "dark" ? "light" : "dark")))
    if (key.name === "r") return restyle(() => setConceal((c) => !c))
    if (seq === "z") return toggleCurrentSection()
    if (seq === "Z") return foldCount ? unfoldAll() : foldToDepth(overviewDepth(outline))
    if (seq === "0") return unfoldAll()
    if (seq >= "1" && seq <= "6" && seq.length === 1) return foldToDepth(Number(seq))
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

  const crumb = ancestry(outline, sectionAt(outline, currentLine))
    .map((i) => outline[i]!.text)
    .join(" › ")
  const status =
    (doc.streaming ? "● streaming" : `${scrollPct}%`) + (foldCount ? ` · ${foldCount} folded` : "")

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

      <box flexGrow={1} flexDirection="row" backgroundColor={theme.background}>
        {showToc && (
          <Toc
            outline={outline}
            collapsed={collapsed}
            active={activeSection}
            cursor={tocFocused ? tocCursor : undefined}
            theme={theme}
            width={tocWidth}
          rows={Math.max(1, height - 3)}
            onSelect={(i) => {
              if (tocFocused) setTocCursor(i)
              jumpToSection(i)
            }}
            onToggle={toggleSection}
          />
        )}
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
            renderNode={renderNode}
            tableOptions={{ style: "grid", cellPaddingX: 1, borderColor: theme.border }}
            conceal={conceal}
            fg={theme.markdownText}
            bg={theme.background}
            paddingX={2}
            paddingTop={1}
            paddingBottom={1}
          />
        </scrollbox>
      </box>

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
          {tocFocused
            ? "↑↓ move · space fold · enter open · esc back"
            : `? help${showToc ? " · tab contents" : " · o contents"} · z fold · e edit · t theme · q quit`}
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
