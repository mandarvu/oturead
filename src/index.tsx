import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { App } from "./App.js"
import { readFileSync } from "fs"
import { resolve, basename } from "path"

const filePath = process.argv[2]

if (!filePath) {
  console.error("Usage: oturead <file.md>")
  process.exit(1)
}

const absolutePath = resolve(filePath)

let content: string
try {
  content = readFileSync(absolutePath, "utf-8")
} catch (err: any) {
  console.error(`oturead: cannot open '${filePath}': ${err.message}`)
  process.exit(1)
}

const filename = basename(absolutePath)

const renderer = await createCliRenderer({
  exitOnCtrlC: true,
})

createRoot(renderer).render(<App content={content} filename={filename} />)
