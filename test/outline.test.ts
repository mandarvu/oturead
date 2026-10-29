import { describe, expect, test } from "bun:test"
import { ancestry, parseOutline, plainHeading, sectionAt } from "../src/outline"

const doc = [
  "# Guide", //           0
  "intro", //             1
  "## Install", //        2
  "", //                  3
  "```sh", //             4
  "# not a heading", //   5
  "```", //               6
  "## Usage", //          7
  "### Flags ###", //     8
  "", //                  9
  "## Usage", //         10
  "# Appendix", //       11
].join("\n")

describe("parseOutline", () => {
  const sections = parseOutline(doc)

  test("finds ATX headings outside code fences", () => {
    expect(sections.map((s) => [s.level, s.text, s.line])).toEqual([
      [1, "Guide", 0],
      [2, "Install", 2],
      [2, "Usage", 7],
      [3, "Flags", 8],
      [2, "Usage", 10],
      [1, "Appendix", 11],
    ])
  })

  test("sections end at the next heading of the same or higher level", () => {
    expect(sections.map((s) => s.end)).toEqual([11, 7, 10, 10, 11, 12])
  })

  test("links parents and depths", () => {
    expect(sections.map((s) => s.parent)).toEqual([undefined, 0, 0, 2, 0, undefined])
    expect(sections.map((s) => s.depth)).toEqual([1, 2, 2, 3, 2, 1])
  })

  test("de-duplicates ids", () => {
    expect(sections.map((s) => s.id)).toEqual(["guide", "install", "usage", "flags", "usage-1", "appendix"])
  })

  test("knows which sections have a body", () => {
    expect(sections.map((s) => s.hasBody)).toEqual([true, true, true, false, false, false])
  })

  test("ignores YAML front matter", () => {
    expect(parseOutline("---\n# comment: x\n---\n# Real").map((s) => s.text)).toEqual(["Real"])
  })
})

describe("plainHeading", () => {
  test("strips inline markup", () => {
    expect(plainHeading("The **`opencode`** [repo](https://x) <u>now</u>")).toBe("The opencode repo now")
  })

  test("renders math and keeps its symbols", () => {
    expect(plainHeading("**Euler**: $e^{\\pi\\iota} = -1$ and $x_i$")).toBe("Euler: e^(πι) = −1 and xᵢ")
  })
})

describe("sectionAt / ancestry", () => {
  const sections = parseOutline(doc)

  test("finds the innermost section containing a line", () => {
    expect(sectionAt(sections, 1)).toBe(0)
    expect(sectionAt(sections, 5)).toBe(1)
    expect(sectionAt(sections, 9)).toBe(3)
    expect(sectionAt(parseOutline("text\n# A"), 0)).toBe(-1)
  })

  test("lists ancestors outermost first", () => {
    expect(ancestry(sections, 3)).toEqual([0, 2, 3])
    expect(ancestry(sections, -1)).toEqual([])
  })
})
