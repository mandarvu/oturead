import { describe, expect, test } from "bun:test"
import { fuzzyFilter, fuzzyMatch } from "../src/fuzzy"

describe("fuzzyMatch", () => {
  test("matches subsequences case-insensitively", () => {
    expect(fuzzyMatch("TN", "tokyonight")?.indices).toEqual([0, 5])
  })

  test("rejects non-subsequences", () => {
    expect(fuzzyMatch("xyz", "tokyonight")).toBeNull()
  })

  test("prefers word starts and consecutive runs", () => {
    expect(fuzzyMatch("cf", "catppuccin-frappe")!.score).toBeGreaterThan(fuzzyMatch("cf", "carbonfox")!.score)
  })
})

describe("fuzzyFilter", () => {
  const items = ["carbonfox", "catppuccin", "catppuccin-frappe", "gruvbox", "tokyonight"]

  test("empty query keeps every item in order", () => {
    expect(fuzzyFilter("  ", items).map((m) => m.item)).toEqual(items)
  })

  test("ranks the best match first and drops misses", () => {
    expect(fuzzyFilter("gruv", items).map((m) => m.item)).toEqual(["gruvbox"])
    expect(fuzzyFilter("cat", items)[0]!.item).toBe("catppuccin")
  })
})
