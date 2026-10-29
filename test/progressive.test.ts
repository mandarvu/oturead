import { expect, test } from "bun:test"
import { leadingBlocks } from "../src/progressive"

test("cuts at the first blank line after the minimum", () => {
  expect(leadingBlocks("a\n\nb\n\nc\n", 1)).toBe("a\n\n")
})

test("never cuts inside a fenced code block", () => {
  const md = "a\n\n```\nx\n\ny\n```\n\nb\n"
  expect(leadingBlocks(md, 3)).toBe("a\n\n```\nx\n\ny\n```\n\n")
})

test("returns short documents whole", () => {
  expect(leadingBlocks("a\n\nb\n", 100)).toBe("a\n\nb\n")
})
