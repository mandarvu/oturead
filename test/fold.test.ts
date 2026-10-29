import { describe, expect, test } from "bun:test"
import { foldMarkdown } from "../src/fold"
import { parseOutline } from "../src/outline"

const doc = ["# Guide", "intro", "", "## Install", "run it", "", "## Usage ##", "use it", "", "# End", ""].join("\n")
const sections = parseOutline(doc)
const fold = (...ids: string[]) => foldMarkdown(doc, sections, new Set(ids))

describe("foldMarkdown", () => {
  test("nothing collapsed returns the document unchanged", () => {
    const folded = fold()
    expect(folded.content).toBe(doc)
    expect(folded.toSource(4)).toBe(4)
  })

  test("a collapsed section keeps its marked heading and drops its body", () => {
    const folded = fold("install")
    expect(folded.content.split("\n")).toEqual([
      "# Guide",
      "intro",
      "",
      "## ▸ Install ⋯",
      "",
      "## Usage ##",
      "use it",
      "",
      "# End",
      "",
    ])
  })

  test("maps rendered lines back to source lines", () => {
    const folded = fold("install")
    expect([3, 4, 5, 6, 8].map(folded.toSource)).toEqual([3, 3, 6, 7, 9])
  })

  test("collapsing a parent hides collapsed children too", () => {
    const folded = fold("guide", "install")
    expect(folded.content.split("\n")).toEqual(["# ▸ Guide ⋯", "", "# End", ""])
    expect(folded.toSource(2)).toBe(9)
  })

  test("closing hashes are dropped from folded headings", () => {
    expect(fold("usage").content).toContain("## ▸ Usage ⋯")
  })

  test("sections without a body are left alone", () => {
    expect(fold("end").content).toBe(doc)
  })
})
