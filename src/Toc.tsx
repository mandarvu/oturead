import { useEffect, useMemo, useState } from "react"
import type { MouseEvent } from "@opentui/core"
import { ancestry, type Section } from "./outline"
import type { Theme } from "./theme"

interface TocProps {
  outline: Section[]
  collapsed: ReadonlySet<string>
  /** Section containing the top of the viewport, or -1. */
  active: number
  /** Keyboard cursor while the table of contents has focus. */
  cursor: number | undefined
  theme: Theme
  width: number
  /** Rows available for entries. */
  rows: number
  onSelect: (index: number) => void
  onToggle: (index: number) => void
}

const isFolded = (section: Section, collapsed: ReadonlySet<string>) => section.hasBody && collapsed.has(section.id)

/** Sections not hidden inside a folded ancestor, in document order. */
export function visibleSections(outline: Section[], collapsed: ReadonlySet<string>): number[] {
  return outline
    .map((_, i) => i)
    .filter((i) =>
      ancestry(outline, i)
        .slice(0, -1)
        .every((a) => !isFolded(outline[a]!, collapsed)),
    )
}

/** Sidebar outline of the document; mirrors folding and follows the reader. */
export function Toc({ outline, collapsed, active, cursor, theme, width, rows, onSelect, onToggle }: TocProps) {
  const visible = useMemo(() => visibleSections(outline, collapsed), [outline, collapsed])
  const hasChildren = useMemo(() => new Set(outline.map((s) => s.parent).filter((p) => p !== undefined)), [outline])
  const panel = theme.backgroundPanel

  // Only the entries that fit are rendered (long documents have hundreds of
  // headings). Keep the cursor, or without focus the active section, in view.
  const [top, setTop] = useState(0)
  const maxTop = Math.max(0, visible.length - rows)
  const focusRow = visible.indexOf(cursor ?? active)
  useEffect(() => {
    if (focusRow < 0) return
    setTop((t) => (focusRow < t ? Math.max(0, focusRow - 2) : focusRow >= t + rows ? focusRow - rows + 3 : t))
  }, [focusRow, rows])
  const first = Math.min(top, maxTop)

  // Mouse-down on the sidebar must not start a text selection or move focus.
  const click = (action: () => void) => (event: MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()
    action()
  }

  return (
    <box
      width={width}
      flexShrink={0}
      flexDirection="column"
      backgroundColor={panel}
      border={["right"]}
      borderColor={cursor !== undefined ? theme.borderActive : theme.borderSubtle}
    >
      <box height={1} paddingX={1} backgroundColor={panel}>
        <text fg={cursor !== undefined ? theme.accent : theme.textMuted} selectable={false}>
          <b>Contents</b>
        </text>
      </box>
      <box
        flexGrow={1}
        flexDirection="column"
        backgroundColor={panel}
        onMouseScroll={(event) => {
          const delta = event.scroll?.direction === "up" ? -3 : event.scroll?.direction === "down" ? 3 : 0
          setTop(Math.max(0, Math.min(maxTop, first + delta)))
        }}
      >
        {visible.slice(first, first + rows).map((i) => {
          const section = outline[i]!
          const folded = isFolded(section, collapsed)
          const marker = folded ? "▸" : hasChildren.has(i) ? "▾" : " "
          const isActive = i === active
          const isCursor = i === cursor
          const bg = isCursor ? theme.backgroundElement : panel
          const fg = isActive ? theme.primary : section.depth === 1 ? theme.text : theme.textMuted
          const indent = 1 + (section.depth - 1) * 2
          const room = width - indent - 2 /* marker */ - 2 /* right padding + border */
          const label = section.text.length > room ? section.text.slice(0, Math.max(1, room - 1)) + "…" : section.text
          return (
            <box
              key={section.id}
              height={1}
              flexDirection="row"
              backgroundColor={bg}
              paddingLeft={indent}
              paddingRight={1}
              onMouseDown={click(() => onSelect(i))}
            >
              <text
                fg={folded ? theme.accent : theme.textMuted}
                bg={bg}
                width={2}
                flexShrink={0}
                selectable={false}
                onMouseDown={click(() => onToggle(i))}
              >
                {marker}
              </text>
              <text fg={fg} bg={bg} wrapMode="none" selectable={false}>
                {isActive ? <b>{label}</b> : label}
              </text>
            </box>
          )
        })}
      </box>
    </box>
  )
}
