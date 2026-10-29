import { readFileSync, watch } from "fs"
import { basename, dirname } from "path"

export type Doc = { content: string; streaming: boolean }

/** A markdown document that may change over time (piped LLM output, a watched file, ...). */
export interface Source {
  readonly title: string
  get(): Doc
  subscribe(listener: () => void): () => void
}

function createSource(title: string, initial: Doc, start: (set: (doc: Doc) => void) => void): Source {
  let doc = initial
  const listeners = new Set<() => void>()
  start((next) => {
    doc = next
    for (const listener of listeners) listener()
  })
  return {
    title,
    get: () => doc,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function fileSource(path: string, title: string, follow: boolean): Source {
  const read = () => readFileSync(path, "utf-8")
  return createSource(title, { content: read(), streaming: false }, (set) => {
    if (!follow) return
    let timer: ReturnType<typeof setTimeout> | undefined
    // Watch the directory: editors that save via rename would orphan a file watcher.
    const name = basename(path)
    watch(dirname(path), (_event, changed) => {
      if (changed && changed !== name) return
      clearTimeout(timer)
      timer = setTimeout(() => {
        try {
          set({ content: read(), streaming: false })
        } catch {
          // File briefly missing during an atomic save; the next event will catch up.
        }
      }, 50)
    })
  })
}

/** Renders stdin as it arrives, e.g. `llm "explain monads" | oturead`. */
export function stdinSource(stream: NodeJS.ReadableStream): Source {
  return createSource("stdin", { content: "", streaming: true }, (set) => {
    let content = ""
    stream.setEncoding?.("utf-8")
    stream.on("data", (chunk: string) => {
      content += chunk
      set({ content, streaming: true })
    })
    stream.on("end", () => set({ content, streaming: false }))
  })
}

/** Replays a document token-by-token to preview how it looks while an LLM streams it. */
export function simulatedSource(full: string, title: string, charsPerSecond: number): Source {
  return createSource(title, { content: "", streaming: true }, (set) => {
    const tokens = full.match(/\s*\S{1,6}|\s+/g) ?? [full]
    const tickMs = 16
    const perTick = Math.max(1, charsPerSecond * (tickMs / 1000))
    let index = 0
    let content = ""
    let budget = 0
    const timer = setInterval(() => {
      budget += perTick
      while (index < tokens.length && budget >= tokens[index]!.length) {
        budget -= tokens[index]!.length
        content += tokens[index++]
      }
      const done = index >= tokens.length
      set({ content, streaming: !done })
      if (done) clearInterval(timer)
    }, tickMs)
  })
}
