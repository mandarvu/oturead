import { useEffect, useMemo, useState } from "react"
import { useKeyboard } from "@opentui/react"
import { fuzzyFilter } from "./fuzzy"
import type { Theme } from "./theme"

interface ThemePickerProps {
  names: string[]
  current: string
  theme: Theme
  width: number
  height: number
  /** Called (debounced) as the selection moves, for live preview. */
  onPreview: (name: string) => void
  onSelect: (name: string) => void
  onCancel: () => void
}

const PREVIEW_DELAY_MS = 120

/** Floating, fuzzy-searchable theme list with live preview. */
export function ThemePicker({ names, current, theme, width, height, onPreview, onSelect, onCancel }: ThemePickerProps) {
  const [query, setQuery] = useState("")
  const [index, setIndex] = useState(() => Math.max(0, names.indexOf(current)))
  const matches = useMemo(() => fuzzyFilter(query, names), [query, names])
  const selected = matches[Math.min(index, matches.length - 1)]?.item

  useEffect(() => {
    if (!selected) return
    const timer = setTimeout(() => onPreview(selected), PREVIEW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [selected, onPreview])

  const edit = (next: string) => {
    setQuery(next)
    setIndex(0)
  }

  useKeyboard((key) => {
    const move = (delta: number) => setIndex((i) => Math.max(0, Math.min(matches.length - 1, i + delta)))
    if (key.name === "escape") return onCancel()
    if (key.name === "return") return selected ? onSelect(selected) : undefined
    if (key.name === "up" || (key.ctrl && (key.name === "p" || key.name === "k"))) return move(-1)
    if (key.name === "down" || key.name === "tab" || (key.ctrl && (key.name === "n" || key.name === "j"))) return move(1)
    if (key.name === "pageup") return move(-10)
    if (key.name === "pagedown") return move(10)
    if (key.name === "backspace") return edit(query.slice(0, -1))
    if (key.ctrl && key.name === "u") return edit("")
    const char = key.sequence
    if (!key.ctrl && !key.meta && char.length === 1 && char >= " " && char !== "\x7f") edit(query + char)
  })

  const boxWidth = Math.min(46, width - 4)
  const listHeight = Math.max(1, Math.min(14, height - 10, names.length))
  const position = Math.min(index, Math.max(0, matches.length - 1))
  const first = Math.max(0, Math.min(position - Math.floor(listHeight / 2), matches.length - listHeight))
  const visible = matches.slice(first, first + listHeight)
  const panel = theme.backgroundPanel

  return (
    <box
      position="absolute"
      top={Math.max(1, Math.floor((height - listHeight - 6) / 2))}
      left={Math.max(0, Math.floor((width - boxWidth) / 2))}
      width={boxWidth}
      border
      borderStyle="rounded"
      borderColor={theme.borderActive}
      backgroundColor={panel}
      title=" themes "
      titleAlignment="center"
      flexDirection="column"
    >
      <box flexDirection="row" paddingX={1} backgroundColor={panel}>
        <text fg={theme.accent}>{"› "}</text>
        <text fg={theme.text}>{query}</text>
        <text fg={theme.background} bg={theme.text}>
          {" "}
        </text>
        <box flexGrow={1} backgroundColor={panel} />
        <text fg={theme.textMuted}>
          {matches.length}/{names.length}
        </text>
      </box>
      <box height={1} border={["top"]} borderColor={theme.borderSubtle} backgroundColor={panel} />
      <box flexDirection="column" height={listHeight} backgroundColor={panel}>
        {visible.length === 0 && (
          <text fg={theme.textMuted} paddingX={1}>
            no matching themes
          </text>
        )}
        {visible.map(({ item, indices }) => {
          const active = item === selected
          const bg = active ? theme.primary : panel
          const fg = active ? theme.background : theme.text
          const hit = new Set(indices)
          return (
            <box key={item} flexDirection="row" paddingX={1} backgroundColor={bg}>
              <text fg={active ? fg : theme.success} bg={bg} width={2} flexShrink={0}>
                {item === current ? "● " : "  "}
              </text>
              <text fg={fg} bg={bg} wrapMode="none">
                {[...item].map((ch, i) =>
                  hit.has(i) ? (
                    <span key={i} fg={active ? fg : theme.accent}>
                      <b>{ch}</b>
                    </span>
                  ) : (
                    ch
                  ),
                )}
              </text>
            </box>
          )
        })}
      </box>
      <box paddingX={1} backgroundColor={panel}>
        <text fg={theme.textMuted}>↑↓ move · enter apply · esc cancel</text>
      </box>
    </box>
  )
}
