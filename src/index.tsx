#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { openSync, readFileSync } from "fs"
import { basename, resolve } from "path"
import { ReadStream } from "tty"
import { parseArgs } from "util"
import "./markdown-ext"
import { App } from "./App"
import { warmUpHighlighter } from "./highlight"
import { fileSource, simulatedSource, stdinSource, type Source } from "./source"
import { loadThemes, type Mode } from "./theme"

const USAGE = `oturead — render markdown in the terminal the way opencode renders LLM output

Usage:
  oturead [options] <file.md>
  some-llm-cli "prompt" | oturead [options]

Options:
  -t, --theme <name>     colour theme (default: opencode)
  -l, --light            use the light variant of the theme
  -w, --watch            re-render when the file changes
  -s, --simulate [cps]   replay the file as if streamed by an LLM (default 400 chars/s)
      --list-themes      print available themes and exit
  -h, --help             show this help
`

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: {
    theme: { type: "string", short: "t", default: process.env.OTUREAD_THEME ?? "opencode" },
    light: { type: "boolean", short: "l", default: false },
    watch: { type: "boolean", short: "w", default: false },
    simulate: { type: "boolean", short: "s", default: false },
    "list-themes": { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
})

if (values.help) {
  process.stdout.write(USAGE)
  process.exit(0)
}

const themes = loadThemes()
if (values["list-themes"]) {
  process.stdout.write(Object.keys(themes).sort().join("\n") + "\n")
  process.exit(0)
}
if (!themes[values.theme!]) {
  console.error(`oturead: unknown theme '${values.theme}' (see --list-themes)`)
  process.exit(1)
}

// `--simulate 800` arrives as a positional; peel off a leading number.
let cps = 400
if (values.simulate && positionals.length > 0 && /^\d+$/.test(positionals[0]!)) {
  cps = Number(positionals.shift())
}

const filePath = positionals[0]
const piped = !process.stdin.isTTY && (!filePath || filePath === "-")

let source: Source
if (piped) {
  source = stdinSource(process.stdin)
} else if (filePath) {
  const absolutePath = resolve(filePath)
  let content: string
  try {
    content = readFileSync(absolutePath, "utf-8")
  } catch (err: any) {
    console.error(`oturead: cannot open '${filePath}': ${err.message}`)
    process.exit(1)
  }
  const title = basename(absolutePath)
  source = values.simulate ? simulatedSource(content, title, cps) : fileSource(absolutePath, title, values.watch!)
} else {
  process.stderr.write(USAGE)
  process.exit(1)
}

// Start tree-sitter now so it loads in parallel with renderer setup.
warmUpHighlighter(source.get().content)

// When markdown arrives on stdin, keyboard input has to come from the terminal itself.
const input = piped ? new ReadStream(openSync("/dev/tty", "r")) : process.stdin

const renderer = await createCliRenderer({
  stdin: input,
  exitOnCtrlC: false,
  useMouse: true,
  targetFps: 60,
})

const exit = () => {
  renderer.destroy()
  process.exit(0)
}

createRoot(renderer).render(
  <App
    source={source}
    themes={themes}
    initialTheme={values.theme!}
    initialMode={(values.light ? "light" : "dark") as Mode}
    onExit={exit}
  />,
)
