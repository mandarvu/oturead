import { describe, expect, test } from "bun:test"
import { marked } from "marked"
import { homedir } from "os"
import { fitImage, locateImage, standaloneImage } from "../src/images"

const paragraph = (md: string) => marked.lexer(md)[0]

describe("standaloneImage", () => {
  test("an image on its own line", () => {
    expect(standaloneImage(paragraph('![Arch diagram](img/arch.png "Overview")'))).toEqual({
      src: "img/arch.png",
      alt: "Arch diagram",
      title: "Overview",
      href: undefined,
    })
  })

  test("an image wrapped in a link", () => {
    expect(standaloneImage(paragraph("[![badge](b.svg)](https://ci)"))).toMatchObject({ src: "b.svg", href: "https://ci" })
  })

  test("images inside running text stay inline", () => {
    expect(standaloneImage(paragraph("see ![x](x.png) here"))).toBeNull()
    expect(standaloneImage(paragraph("![a](a.png) ![b](b.png)"))).toBeNull()
    expect(standaloneImage(paragraph("just text"))).toBeNull()
  })
})

describe("locateImage", () => {
  test("relative paths resolve against the document's folder", () => {
    expect(locateImage("img/my%20pic.png?raw=1", "/docs", false)).toEqual({ kind: "file", path: "/docs/img/my pic.png" })
    expect(locateImage("/abs/a.png", "/docs", false)).toEqual({ kind: "file", path: "/abs/a.png" })
    expect(locateImage("~/a.png", "/docs", false)).toEqual({ kind: "file", path: `${homedir()}/a.png` })
    expect(locateImage("file:///tmp/a.png", "/docs", false)).toEqual({ kind: "file", path: "/tmp/a.png" })
  })

  test("remote images are blocked unless allowed", () => {
    expect(locateImage("https://x.dev/a.png", "/docs", false)).toEqual({ kind: "blocked", url: "https://x.dev/a.png" })
    expect(locateImage("https://x.dev/a.png", "/docs", true)).toEqual({ kind: "remote", url: "https://x.dev/a.png" })
  })

  test("base64 data URIs are decoded, other schemes rejected", () => {
    const located = locateImage("data:image/png;base64,iVBORw0K", "/docs", false)
    expect(located.kind).toBe("data")
    expect(locateImage("ftp://x/a.png", "/docs", false).kind).toBe("invalid")
  })
})

describe("fitImage", () => {
  test("fills the width, keeping the aspect ratio for 1:2 cells", () => {
    expect(fitImage(800, 400, 80, 100)).toEqual({ columns: 80, rows: 20 })
  })

  test("caps the height and narrows to match", () => {
    expect(fitImage(400, 800, 80, 20)).toEqual({ columns: 20, rows: 20 })
  })

  test("never scales up when the cell size is known", () => {
    expect(fitImage(160, 160, 80, 40, { width: 8, height: 16 })).toEqual({ columns: 20, rows: 10 })
  })
})
