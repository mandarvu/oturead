import { afterEach, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import { join } from "path"
import "../src/markdown-ext"
import { App } from "../src/App"
import type { Source } from "../src/source"
import { loadThemes } from "../src/theme"

const content = [
  "# Pictures",
  "",
  "![A gradient](gradient.png)",
  "",
  "Inline ![tiny](gradient.png) stays text.",
  "",
  "![Logo](https://example.com/logo.png)",
  "",
  "![Gone](missing.png)",
  "",
  "The end.",
].join("\n")
const doc = { content, streaming: false }
const source: Source = { title: "pics.md", get: () => doc, subscribe: () => () => {} }

let setup: Awaited<ReturnType<typeof testRender>>
afterEach(() => setup?.renderer.destroy())

async function render(allowRemote = false) {
  setup = await testRender(
    <App
      source={source}
      themes={loadThemes()}
      initialTheme="opencode"
      initialMode="dark"
      images={{ baseDir: join(import.meta.dir, "fixtures"), allowRemote }}
      onExit={() => {}}
    />,
    { width: 70, height: 30 },
  )
  // Images load in the background.
  for (let i = 0; i < 8; i++) {
    await setup.renderOnce()
    await Bun.sleep(30)
  }
}

const rows = () =>
  setup
    .captureCharFrame()
    .split("\n")
    .slice(1, -2)
    .map((row) => row.slice(0, -2).trim())
    .filter(Boolean)

test("an image on its own line is drawn, sized by its pixels, with its alt text below", async () => {
  await render()
  const all = rows()
  const picture = all.filter((row) => /^[▀▄█]+$/.test(row))
  // 40×20 px drawn with half blocks: 40 columns, 10 rows.
  expect(picture).toHaveLength(10)
  expect(picture[0]).toHaveLength(40)
  expect(all[all.lastIndexOf(picture.at(-1)!) + 1]).toBe("A gradient")
})

test("inline images keep their alt text; remote and missing images explain themselves", async () => {
  await render()
  const all = rows()
  expect(all).toContain("Inline tiny stays text.")
  expect(all.join(" ")).toContain("▣ Logo — remote image not loaded (start oturead with")
  expect(all).toContain("▣ Gone — can't read missing.png")
})

test("raw mode shows the image markdown instead", async () => {
  await render()
  setup.mockInput.pressKey("r")
  for (let i = 0; i < 4; i++) {
    await setup.renderOnce()
    await Bun.sleep(30)
  }
  expect(rows()).toContain("![A gradient](gradient.png)")
})
