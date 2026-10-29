import { describe, expect, test } from "bun:test"
import { editorCommand, resolveEditor } from "../src/editor"

describe("resolveEditor", () => {
  test("prefers VISUAL, then EDITOR, then vi", () => {
    expect(resolveEditor({ VISUAL: "nvim", EDITOR: "nano" })).toBe("nvim")
    expect(resolveEditor({ EDITOR: "nano" })).toBe("nano")
    expect(resolveEditor({ VISUAL: " ", EDITOR: "" })).toBe("vi")
  })
})

describe("editorCommand", () => {
  test("terminal editors take +LINE", () => {
    expect(editorCommand("nvim", "a.md", 12)).toEqual(["nvim", "+12", "a.md"])
    expect(editorCommand("/usr/bin/nano", "a.md", 3)).toEqual(["/usr/bin/nano", "+3", "a.md"])
    expect(editorCommand("emacs -nw", "a.md", 7)).toEqual(["emacs", "-nw", "+7", "a.md"])
  })

  test("helix takes FILE:LINE", () => {
    expect(editorCommand("hx", "a.md", 5)).toEqual(["hx", "a.md:5"])
  })

  test("VS Code family gets --wait and --goto", () => {
    expect(editorCommand("code", "a.md", 9)).toEqual(["code", "--wait", "--goto", "a.md:9"])
  })

  test("an existing wait flag is not duplicated", () => {
    expect(editorCommand("code --wait", "a.md", 9)).toEqual(["code", "--wait", "--goto", "a.md:9"])
    expect(editorCommand("subl -w", "a.md", 2)).toEqual(["subl", "-w", "a.md:2"])
  })
})
