import {
  BoxRenderable,
  ImageError,
  ImageLoadError,
  ImageRenderable,
  TextRenderable,
  type CliRenderer,
  type ImageRenderableSource,
  type OptimizedBuffer,
} from "@opentui/core"
import { basename } from "path"
import { fitImage, locateImage, type StandaloneImage } from "./images"
import type { Theme } from "./theme"

export type ImageOptions = {
  /** Folder that relative image paths resolve against. */
  baseDir: string
  /** Load http(s) images; off by default. */
  allowRemote: boolean
}

/**
 * A block showing `image` under the document's text: the picture (kitty
 * graphics, sixel or half-block characters, whatever the terminal supports)
 * with its alt text as a caption. Loads in the background and sizes itself
 * to the available width once the image's dimensions are known.
 */
export function createImageBlock(renderer: CliRenderer, image: StandaloneImage, options: ImageOptions, theme: Theme) {
  const label = image.alt.trim() || basename(image.src.replace(/[?#].*$/, ""))
  const block = new ImageBlock(renderer, { width: "100%", flexDirection: "column", flexShrink: 0, marginTop: 1 })
  const picture = new ImageRenderable(renderer, { width: 0, height: 0, flexShrink: 0, fit: "fit" })
  const caption = new TextRenderable(renderer, { fg: theme.textMuted, wrapMode: "word", selectable: false })
  block.add(picture)
  block.add(caption)

  const say = (text: string, warn = false) => {
    caption.content = text
    caption.fg = warn ? theme.warning : theme.textMuted
  }

  // The terminal reports its cell size in pixels some time after startup
  // (and again after a resize), so re-fit whenever an input to the fit changes.
  let fittedFor = ""
  const fit = () => {
    const loaded = picture.image
    const resolution = renderer.resolution
    const key = `${block.width}:${renderer.terminalHeight}:${resolution?.width}x${resolution?.height}`
    if (!loaded || block.width <= 0 || key === fittedFor) return
    fittedFor = key
    const cell =
      resolution && renderer.terminalWidth > 0
        ? { width: resolution.width / renderer.terminalWidth, height: resolution.height / renderer.terminalHeight }
        : { width: 1, height: 2 } // half-block rendering: one pixel per column, two per row
    const maxRows = Math.max(6, Math.floor(renderer.terminalHeight * 0.6))
    const size = fitImage(loaded.width, loaded.height, block.width, maxRows, cell)
    if (picture.width !== size.columns) picture.width = size.columns
    if (picture.height !== size.rows) picture.height = size.rows
  }

  block.beforeRender = fit

  const located = locateImage(image.src, options.baseDir, options.allowRemote)
  let source: ImageRenderableSource | undefined
  switch (located.kind) {
    case "file":
      source = located.path
      break
    case "data":
      source = located.bytes
      break
    case "remote":
      source = new URL(located.url)
      break
    case "blocked":
      say(`▣ ${label} — remote image not loaded (start oturead with --remote-images)`)
      return block
    case "invalid":
      say(`▣ ${label} — ${located.reason}`, true)
      return block
  }

  say(`▣ ${label} …`)
  picture.onLoad = () => {
    fit()
    say(image.alt.trim() || image.title?.trim() || "")
    if (!caption.plainText) caption.visible = false
  }
  picture.onError = (error) => say(`▣ ${label} — ${describeError(error, image.src)}`, true)
  picture.source = source
  return block
}

function describeError(error: unknown, src: string): string {
  if (error instanceof ImageLoadError) {
    if (error.code === "file-read") return `can't read ${src}`
    if (error.code === "http-status") return `HTTP ${error.status ?? "error"} for ${src}`
    if (error.code === "network") return `network error loading ${src}`
  }
  if (error instanceof ImageError) {
    if (error.code === "unsupported-format") return "unsupported image format (PNG, JPEG, WebP and GIF work)"
    return `can't decode image (${error.code})`
  }
  return error instanceof Error ? error.message.split("\n")[0]! : String(error)
}

class ImageBlock extends BoxRenderable {
  beforeRender?: () => void

  protected override renderSelf(buffer: OptimizedBuffer): void {
    this.beforeRender?.()
    super.renderSelf(buffer)
  }
}
