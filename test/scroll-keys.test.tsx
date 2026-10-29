import { afterEach, expect, test } from "bun:test"
import type { ScrollBoxRenderable } from "@opentui/core"
import { testRender } from "@opentui/react/test-utils"
import "../src/markdown-ext"
import { App } from "../src/App"
import type { Source } from "../src/source"
import { loadThemes } from "../src/theme"

const content = Array.from({ length: 200 }, (_, i) => `Line ${i}\n`).join("\n")
const doc = { content, streaming: false }
const source: Source = { title: "doc.md", get: () => doc, subscribe: () => () => {} }

let setup: Awaited<ReturnType<typeof testRender>>
afterEach(() => setup?.renderer.destroy())

async function render() {
  setup = await testRender(
    <App source={source} themes={loadThemes()} initialTheme="opencode" initialMode="dark" onExit={() => {}} />,
    { width: 60, height: 20 },
  )
  await settle()
}

async function settle() {
  for (let i = 0; i < 3; i++) {
    await setup.renderOnce()
    await Bun.sleep(20)
  }
}

function scrollbox(): ScrollBoxRenderable {
  let found: ScrollBoxRenderable | undefined
  const walk = (node: any) => {
    if (node.constructor?.name === "ScrollBoxRenderable") found = node
    for (const child of node.getChildren?.() ?? []) walk(child)
  }
  walk(setup.renderer.root)
  return found!
}

async function scrolledBy(key: string) {
  const before = scrollbox().scrollTop
  setup.mockInput.pressKey(key)
  await settle()
  return scrollbox().scrollTop - before
}

test("j/k scroll one line, also after selecting text with the mouse", async () => {
  await render()
  expect(await scrolledBy("j")).toBe(1)

  // Mouse-down used to focus the scrollbox, whose own key handling then
  // scrolled a fifth of the viewport on top of ours.
  await setup.mockMouse.drag(5, 3, 30, 4)
  await settle()
  expect(await scrolledBy("j")).toBe(1)
  expect(await scrolledBy("k")).toBe(-1)
})

test("the mouse wheel still scrolls", async () => {
  await render()
  const before = scrollbox().scrollTop
  await setup.mockMouse.scroll(10, 8, "down")
  await settle()
  expect(scrollbox().scrollTop).toBeGreaterThan(before)
})
