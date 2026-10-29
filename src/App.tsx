import React, { useRef, useState, useCallback } from "react"
import { useKeyboard, useTerminalDimensions } from "@opentui/react"
import { SyntaxStyle } from "@opentui/core"
import type { ScrollBoxRenderable } from "@opentui/core"

const syntaxStyle = SyntaxStyle.create()

interface AppProps {
  content: string
  filename: string
}

export function App({ content, filename }: AppProps) {
  const scrollRef = useRef<ScrollBoxRenderable>(null)
  const [scrollPct, setScrollPct] = useState(0)
  const { width, height } = useTerminalDimensions()

  const updateScrollPct = useCallback(() => {
    const box = scrollRef.current
    if (!box) return
    const maxScroll = box.scrollHeight - box.height
    if (maxScroll <= 0) {
      setScrollPct(100)
      return
    }
    setScrollPct(Math.round((box.scrollTop / maxScroll) * 100))
  }, [])

  useKeyboard((key) => {
    const box = scrollRef.current

    if (key.name === "q") {
      process.exit(0)
      return
    }

    if (!box) return

    if (key.name === "j" || key.name === "down") {
      box.scrollBy(3)
    } else if (key.name === "k" || key.name === "up") {
      box.scrollBy(-3)
    } else if (key.name === "d" || key.name === "f" || key.name === "pagedown") {
      box.scrollBy(0.5, "viewport")
    } else if (key.name === "u" || key.name === "b" || key.name === "pageup") {
      box.scrollBy(-0.5, "viewport")
    } else if (key.name === "g" && !key.shift) {
      box.scrollTo(0)
    } else if (key.name === "g" && key.shift) {
      box.scrollTo(999999)
    } else if (key.name === "home") {
      box.scrollTo(0)
    } else if (key.name === "end") {
      box.scrollTo(999999)
    } else {
      return
    }

    updateScrollPct()
  })

  const TITLE_BAR_H = 1
  const STATUS_BAR_H = 1
  const contentAreaH = height - TITLE_BAR_H - STATUS_BAR_H

  return (
    <box width={width} height={height} flexDirection="column">
      <box width={width} height={TITLE_BAR_H}>
        <text content={` oturead — ${filename}`} width={width} />
      </box>

      <scrollbox
        ref={scrollRef}
        width={width}
        height={contentAreaH}
        scrollY={true}
        scrollX={false}
      >
        <markdown
          content={content}
          syntaxStyle={syntaxStyle}
          width={width}
          paddingX={2}
          paddingBottom={2}
          conceal={true}
        />
      </scrollbox>

      <box width={width} height={STATUS_BAR_H}>
        <text
          content={` ${scrollPct}%  q:quit  j/k:↓↑  d/f/u/b:page  g/G:top/bot`}
          width={width}
        />
      </box>
    </box>
  )
}
