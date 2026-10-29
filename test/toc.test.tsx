import { afterEach, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import "../src/markdown-ext"
import { App } from "../src/App"
import type { Source } from "../src/source"
import { loadThemes } from "../src/theme"

const body = (name: string) => Array.from({ length: 20 }, (_, i) => `${name} line ${i}\n`).join("\n")
const content = `# Doc\n\nintro\n\n## Alpha\n\n${body("alpha")}\n## Beta\n\n${body("beta")}\n### Beta one\n\n${body("b1")}\n## Gamma\n\n${body("gamma")}`
const doc = { content, streaming: false }
const source: Source = { title: "doc.md", get: () => doc, subscribe: () => () => {} }

let setup: Awaited<ReturnType<typeof testRender>>
afterEach(() => setup?.renderer.destroy())

async function render(width = 110) {
  setup = await testRender(
    <App source={source} themes={loadThemes()} initialTheme="opencode" initialMode="dark" onExit={() => {}} />,
    { width, height: 16 },
  )
  await settle()
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await setup.renderOnce()
    await Bun.sleep(25)
  }
}

async function press(...keys: string[]) {
  for (const key of keys) {
    if (key === "tab") setup.mockInput.pressTab()
    else if (key === "enter") setup.mockInput.pressEnter()
    else if (key === "escape") setup.mockInput.pressEscape()
    else setup.mockInput.pressKey(key)
    await settle()
  }
}

const frame = () => setup.captureCharFrame().split("\n")
const tocRows = () => frame().map((row) => row.split("│")[0]!.trim())
const header = () => frame()[0]!
/** First non-empty document row (right of the sidebar). */
const topDocRow = () =>
  frame()
    .slice(2, -2)
    .map((row) => (row.split("│")[1] ?? "").slice(0, -2).trim())
    .find(Boolean)

test("wide terminals show the contents, narrow ones don't, and o toggles it", async () => {
  await render(110)
  expect(tocRows().slice(1, 6)).toEqual(["Contents", "▾ Doc", "Alpha", "▾ Beta", "Beta one"])
  await press("o")
  expect(frame()[2]).not.toContain("Contents")
  await settle()

  setup.renderer.destroy()
  await render(80)
  expect(frame()[1]).not.toContain("Contents")
  await press("o")
  expect(frame()[1]).toContain("Contents")
})

test("tab focuses the contents; moving the cursor scrolls the document", async () => {
  await render()
  await press("tab", "j")
  expect(header()).toContain("› Doc › Alpha")
  expect(topDocRow()).toBe("Alpha")
  await press("j")
  expect(topDocRow()).toBe("Beta")
  expect(frame().at(-2)).toContain("esc back")
  await press("escape")
  expect(frame().at(-2)).not.toContain("esc back")
})

test("space folds from the contents, and folded children disappear from it", async () => {
  await render()
  await press("tab", "j", "j", " ")
  expect(topDocRow()).toBe("▸ Beta ⋯")
  expect(tocRows().slice(2, 6)).toEqual(["▾ Doc", "Alpha", "▸ Beta", "Gamma"])
  await press("l") // unfold again
  expect(tocRows()[5]).toBe("Beta one")
})

test("enter on a folded section unfolds it and returns focus to the document", async () => {
  await render()
  await press("2", "tab", "j", "enter")
  expect(topDocRow()).toBe("Alpha")
  expect(frame().at(-2)).not.toContain("esc back")
  expect(frame().join("\n")).toContain("alpha line 0")
})

test("clicking an entry jumps to it, clicking its marker folds it", async () => {
  await render()
  const betaRow = tocRows().indexOf("▾ Beta")
  await setup.mockMouse.click(12, betaRow)
  await settle()
  expect(topDocRow()).toBe("Beta")

  await setup.mockMouse.click(3, betaRow) // the ▾ marker
  await settle()
  expect(topDocRow()).toBe("▸ Beta ⋯")
})

test("a long outline follows the reader and scrolls with the mouse wheel", async () => {
  const many = Array.from({ length: 40 }, (_, i) => `## Part ${i}\n\ntext ${i}\n`).join("\n")
  const longDoc = { content: many, streaming: false }
  setup = await testRender(
    <App
      source={{ title: "long.md", get: () => longDoc, subscribe: () => () => {} }}
      themes={loadThemes()}
      initialTheme="opencode"
      initialMode="dark"
      onExit={() => {}}
    />,
    { width: 110, height: 16 },
  )
  await settle()
  expect(tocRows()).toContain("Part 0")
  expect(tocRows()).not.toContain("Part 39")

  await press("G") // jump to the end: the contents follow the section at the top of the screen
  const current = header().split("›").at(-1)!.trim().split(/\s{2,}/)[0]!
  expect(current).toMatch(/^Part 3\d$/)
  expect(tocRows()).toContain(current)
  expect(tocRows()).not.toContain("Part 0")

  await setup.mockMouse.scroll(10, 6, "up")
  await setup.mockMouse.scroll(10, 6, "up")
  await settle()
  expect(tocRows()).not.toContain(current)
})
