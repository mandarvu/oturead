import { afterEach, expect, test } from "bun:test"
import { testRender } from "@opentui/react/test-utils"
import "../src/markdown-ext"
import { App } from "../src/App"
import type { Source } from "../src/source"
import { loadThemes } from "../src/theme"

const body = (name: string) => Array.from({ length: 20 }, (_, i) => `${name} line ${i}\n`).join("\n")
const content = `# Doc\n\nintro\n\n## Alpha\n\n${body("alpha")}\n## Beta\n\n${body("beta")}\n## Gamma\n\n${body("gamma")}`
const doc = { content, streaming: false }
const source: Source = { title: "doc.md", get: () => doc, subscribe: () => () => {} }

let setup: Awaited<ReturnType<typeof testRender>>
afterEach(() => setup?.renderer.destroy())

async function render() {
  setup = await testRender(
    <App source={source} themes={loadThemes()} initialTheme="opencode" initialMode="dark" onExit={() => {}} />,
    { width: 60, height: 16 },
  )
  await settle()
}

async function settle() {
  for (let i = 0; i < 4; i++) {
    await setup.renderOnce()
    await Bun.sleep(25)
  }
}

async function press(keys: string) {
  for (const key of keys) {
    setup.mockInput.pressKey(key)
    await settle()
  }
}

/** Non-empty document rows: the frame without the title/status bars and the scrollbar column. */
const rows = () =>
  setup
    .captureCharFrame()
    .split("\n")
    .slice(1, -2)
    .map((row) => row.slice(0, -2).trim())
    .filter(Boolean)

test("z folds the section at the top of the screen and keeps its heading there", async () => {
  await render()
  await press("]") // first heading below the top of the screen
  expect(rows()[0]).toBe("Alpha")
  await press("z")
  expect(rows()[0]).toBe("▸ Alpha ⋯")
  expect(rows()[1]).toBe("Beta")
  expect(setup.captureCharFrame()).toContain("1 folded")

  await press("z") // unfold again
  expect(rows()[0]).toBe("Alpha")
  expect(rows()[1]).toBe("alpha line 0")
})

test("a digit folds to that depth and 0 unfolds everything", async () => {
  await render()
  await press("2")
  expect(rows()).toEqual(["Doc", "intro", "▸ Alpha ⋯", "▸ Beta ⋯", "▸ Gamma ⋯"])
  await press("0")
  expect(rows()).toContain("alpha line 0")
})

test("Z folds to an overview and back", async () => {
  await render()
  await press("Z") // single H1, so the overview is at depth 2
  expect(rows()).toEqual(["Doc", "intro", "▸ Alpha ⋯", "▸ Beta ⋯", "▸ Gamma ⋯"])
  await press("Z")
  expect(rows()).toContain("alpha line 0")
})
