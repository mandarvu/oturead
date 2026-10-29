import { expect, test } from "bun:test"
import { BUNDLED_THEMES } from "../src/themes"
import { resolveTheme } from "../src/theme"

test("every bundled theme resolves in dark and light mode", () => {
  for (const [name, json] of Object.entries(BUNDLED_THEMES)) {
    for (const mode of ["dark", "light"] as const) {
      expect(() => resolveTheme(json, mode), `${name} (${mode})`).not.toThrow()
    }
  }
})

test("a theme key may reference a def of the same name", () => {
  const base = BUNDLED_THEMES.opencode!
  const json = {
    defs: { ...base.defs, warning: "#f1c21b" },
    theme: { ...base.theme, warning: { dark: "warning", light: "warning" } },
  }
  const theme = resolveTheme(json, "dark")
  expect(theme.warning.toInts()).toEqual([241, 194, 27, 255])
})

test("real cycles are reported", () => {
  expect(() => resolveTheme({ theme: { text: "primary", primary: "text" } }, "dark")).toThrow(/circular/)
})
