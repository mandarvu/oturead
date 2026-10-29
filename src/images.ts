import { homedir } from "os"
import { isAbsolute, join } from "path"
import { fileURLToPath } from "url"

// Pure helpers for showing markdown images: which images get a block of
// their own, where they load from, and how many terminal cells they take.

export type StandaloneImage = {
  src: string
  alt: string
  title?: string
  /** Set when the image is wrapped in a link: [![alt](img)](href). */
  href?: string
}

/**
 * The image when a paragraph token consists of nothing but one image
 * (optionally wrapped in a link). Images inside running text return null:
 * a terminal line can't hold a picture, so those keep their alt text.
 */
export function standaloneImage(token: any): StandaloneImage | null {
  if (token?.type !== "paragraph" || !Array.isArray(token.tokens)) return null
  const parts = token.tokens.filter((t: any) => !(t.type === "text" && !t.text.trim()) && t.type !== "br")
  if (parts.length !== 1) return null
  let node = parts[0]
  let href: string | undefined
  if (node.type === "link") {
    const inner = (node.tokens ?? []).filter((t: any) => !(t.type === "text" && !t.text.trim()))
    if (inner.length !== 1 || inner[0].type !== "image") return null
    href = node.href
    node = inner[0]
  }
  if (node.type !== "image" || !node.href) return null
  return { src: node.href, alt: node.text ?? "", title: node.title ?? undefined, href }
}

export type ImageLocation =
  | { kind: "file"; path: string }
  | { kind: "data"; bytes: Uint8Array }
  | { kind: "remote"; url: string }
  | { kind: "blocked"; url: string }
  | { kind: "invalid"; reason: string }

/** Where `src` loads from: relative paths resolve against the document's folder; remote URLs need opting in. */
export function locateImage(src: string, baseDir: string, allowRemote: boolean): ImageLocation {
  const trimmed = src.trim()
  if (/^https?:\/\//i.test(trimmed)) return allowRemote ? { kind: "remote", url: trimmed } : { kind: "blocked", url: trimmed }
  if (/^data:/i.test(trimmed)) {
    const match = /^data:[^;,]*;base64,(.*)$/is.exec(trimmed)
    if (!match) return { kind: "invalid", reason: "only base64 data URIs are supported" }
    return { kind: "data", bytes: Uint8Array.from(Buffer.from(match[1]!, "base64")) }
  }
  if (/^file:\/\//i.test(trimmed)) {
    try {
      return { kind: "file", path: fileURLToPath(trimmed) }
    } catch {
      return { kind: "invalid", reason: "bad file URL" }
    }
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return { kind: "invalid", reason: `unsupported scheme in ${trimmed}` }

  let path = trimmed
  try {
    path = decodeURIComponent(trimmed) // ![x](my%20diagram.png)
  } catch {
    // Keep it as written.
  }
  path = path.replace(/[?#].*$/, "")
  if (path === "~" || path.startsWith("~/")) return { kind: "file", path: join(homedir(), path.slice(1)) }
  return { kind: "file", path: isAbsolute(path) ? path : join(baseDir, path) }
}

/**
 * Size in cells for an image of `pixelWidth`×`pixelHeight`, within
 * `maxColumns`×`maxRows`, keeping its aspect ratio. `cell` is the cell size
 * in pixels when the terminal reports it: then images are never scaled up.
 */
export function fitImage(
  pixelWidth: number,
  pixelHeight: number,
  maxColumns: number,
  maxRows: number,
  cell?: { width: number; height: number },
): { columns: number; rows: number } {
  if (pixelWidth <= 0 || pixelHeight <= 0 || maxColumns <= 0 || maxRows <= 0) return { columns: 0, rows: 0 }
  const cellAspect = cell ? cell.height / cell.width : 2 // terminal cells are about twice as tall as wide
  let columns = maxColumns
  if (cell) columns = Math.min(columns, Math.ceil(pixelWidth / cell.width))
  let rows = (columns * pixelHeight) / pixelWidth / cellAspect
  if (rows > maxRows) {
    rows = maxRows
    columns = (rows * cellAspect * pixelWidth) / pixelHeight
  }
  return { columns: Math.max(1, Math.round(columns)), rows: Math.max(1, Math.round(rows)) }
}
