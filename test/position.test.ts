import { describe, expect, test } from "bun:test"
import { followLine, lineAtRow, locateBlocks, rowOfLine, type BlockSpan } from "../src/position"

const content = "# Title\n\nPara one\nstill para\n\n```js\na()\nb()\n```\n\n- x\n- y\n"
const raws = ["# Title\n\n", "Para one\nstill para\n\n", "```js\na()\nb()\n```\n\n", "- x\n- y\n"]

describe("locateBlocks", () => {
  test("finds each block's start line and line count", () => {
    expect(locateBlocks(content, raws)).toEqual([
      { line: 0, lines: 1 },
      { line: 2, lines: 2 },
      { line: 5, lines: 4 },
      { line: 10, lines: 2 },
    ])
  })

  test("keeps going when a raw can't be found verbatim", () => {
    const located = locateBlocks(content, ["# Title", "not in content", "- x\n- y"])
    expect(located[2]).toEqual({ line: 10, lines: 2 })
  })
})

// Rendered layout for the blocks above: one blank row between blocks, and the
// code fence lines are hidden so the code block renders 2 rows for 4 lines.
const blocks: BlockSpan[] = [
  { line: 0, lines: 1, offset: 0, height: 1 },
  { line: 2, lines: 2, offset: 2, height: 2 },
  { line: 5, lines: 4, offset: 5, height: 2 },
  { line: 10, lines: 2, offset: 8, height: 2 },
]

describe("lineAtRow", () => {
  test("maps rows inside a block to its lines", () => {
    expect(lineAtRow(blocks, 0)).toBe(0)
    expect(lineAtRow(blocks, 3)).toBe(3)
    expect(lineAtRow(blocks, 9)).toBe(11)
  })

  test("rows in a gap point at the next block", () => {
    expect(lineAtRow(blocks, 1)).toBe(2)
    expect(lineAtRow(blocks, 7)).toBe(10)
  })

  test("never runs past a block's rendered height", () => {
    expect(lineAtRow(blocks, 6)).toBe(6)
  })
})

describe("rowOfLine", () => {
  test("is the inverse of lineAtRow for visible lines", () => {
    for (const row of [0, 2, 3, 5, 8, 9]) expect(rowOfLine(blocks, lineAtRow(blocks, row))).toBe(row)
  })

  test("lines past a block's rendered height clamp to its last row", () => {
    expect(rowOfLine(blocks, 8)).toBe(6)
  })

  test("blank lines between blocks map to the block above", () => {
    expect(rowOfLine(blocks, 4)).toBe(3)
  })
})

describe("followLine", () => {
  const before = "a\nb\nc\nd\ne"

  test("lines above an edit keep their number", () => {
    expect(followLine(before, "a\nb\nc\nd\nE", 1)).toBe(1)
  })

  test("lines below an insertion move down with it", () => {
    expect(followLine(before, "a\nnew\nnew\nb\nc\nd\ne", 3)).toBe(5)
  })

  test("lines below a deletion move up with it", () => {
    expect(followLine(before, "a\nd\ne", 4)).toBe(2)
  })

  test("a line inside the edited region keeps its number, clamped to the file", () => {
    expect(followLine(before, "a\nX\ne", 2)).toBe(2)
    expect(followLine(before, "a", 3)).toBe(0)
  })
})
