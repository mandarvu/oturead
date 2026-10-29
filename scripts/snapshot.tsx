// Headless render of a markdown file to HTML (for eyeballing output / docs screenshots).
// Usage: bun scripts/snapshot.tsx <file.md> <out.html> [cols] [rows] [theme] [keys]
// [keys] is a string of keypresses to send before capturing, e.g. "]]]" or "?".
import { RGBA, TextAttributes } from "@opentui/core"
import { testRender } from "@opentui/react/test-utils"
import { readFileSync, writeFileSync } from "fs"
import "../src/markdown-ext"
import { App } from "../src/App"
import { warmUpHighlighter } from "../src/highlight"
import { fileSource } from "../src/source"
import { loadThemes } from "../src/theme"

const [file, out, cols = "100", rows = "60", theme = "opencode", keys = ""] = process.argv.slice(2)
warmUpHighlighter(readFileSync(file!, "utf-8"))
const setup = await testRender(
  <App source={fileSource(file!, file!.split("/").pop()!, false)} themes={loadThemes()} initialTheme={theme} initialMode="dark" onExit={() => {}} />,
  { width: Number(cols), height: Number(rows) },
)
for (let i = 0; i < 40; i++) { await setup.renderOnce(); await Bun.sleep(100) }
for (const key of keys) {
  setup.mockInput.pressKey(key)
  for (let i = 0; i < 3; i++) await setup.renderOnce()
}
for (let i = 0; i < 5; i++) { await setup.renderOnce(); await Bun.sleep(50) }
const frame = setup.captureSpans()
const hex = (c: RGBA) => { const [r, g, b, a] = c.toInts(); return a === 0 ? "transparent" : `rgb(${r},${g},${b})` }
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
let html = `<html><body style="margin:0;background:#000"><pre style="font:14px/18px 'DejaVu Sans Mono',monospace;margin:0;white-space:pre">`
for (const line of frame.lines) {
  for (const s of line.spans) {
    const a = s.attributes
    const st = [`color:${hex(s.fg)}`, `background:${hex(s.bg)}`, "display:inline-block", "height:18px", "vertical-align:top"]
    if (a & TextAttributes.BOLD) st.push("font-weight:bold")
    if (a & TextAttributes.ITALIC) st.push("font-style:italic")
    if (a & TextAttributes.UNDERLINE) st.push("text-decoration:underline")
    html += `<span style="${st.join(";")}">${esc(s.text)}</span>`
  }
  html += "<br>"
}
writeFileSync(out!, html + "</pre></body></html>")
console.log(setup.captureCharFrame())
setup.renderer.destroy()
process.exit(0)
