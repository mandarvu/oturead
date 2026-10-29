import { spawnSync } from "child_process"
import { basename } from "path"

/** The user's editor command, following git's lookup order. */
export function resolveEditor(env: NodeJS.ProcessEnv = process.env): string {
  return env.VISUAL?.trim() || env.EDITOR?.trim() || "vi"
}

/**
 * Builds the argv that opens `file` at 1-based `line` with `editor`, which may
 * carry its own arguments (e.g. "code --wait"). GUI editors get their
 * wait flag so we only resume once the file is closed.
 */
export function editorCommand(editor: string, file: string, line: number): string[] {
  const [bin = "vi", ...args] = editor.split(/\s+/).filter(Boolean)
  const name = basename(bin).replace(/\.exe$/, "")
  const wait = (flag: string) => (args.includes(flag) || args.includes("-w") ? [] : [flag])

  switch (name) {
    case "code":
    case "code-insiders":
    case "codium":
    case "cursor":
    case "windsurf":
      return [bin, ...args, ...wait("--wait"), "--goto", `${file}:${line}`]
    case "subl":
    case "zed":
      return [bin, ...args, ...wait("--wait"), `${file}:${line}`]
    case "hx":
    case "helix":
      return [bin, ...args, `${file}:${line}`]
    default:
      // vi, vim, nvim, nano, emacs, micro, kak, joe, ne, mg, ... all take +LINE.
      return [bin, ...args, `+${line}`, file]
  }
}

/** Runs the editor on the current terminal and waits for it to exit. Returns an error message on failure. */
export function openInEditor(file: string, line: number): string | undefined {
  const editor = resolveEditor()
  const [bin, ...args] = editorCommand(editor, file, line)
  const result = spawnSync(bin!, args, { stdio: "inherit" })
  if (result.error) return `could not start editor '${bin}': ${result.error.message}`
  if (result.status) return `${basename(bin!)} exited with status ${result.status}`
}
