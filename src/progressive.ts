/**
 * Returns a prefix of `markdown` covering at least `minLines` lines, cut at a
 * blank line outside fenced code so no block is split. Rendering this first
 * lets large documents paint their first screens before the rest is built.
 */
export function leadingBlocks(markdown: string, minLines: number): string {
  let fence: string | undefined
  let line = 0
  let start = 0
  while (start < markdown.length) {
    let end = markdown.indexOf("\n", start)
    if (end === -1) end = markdown.length
    const text = markdown.slice(start, end)
    const marker = /^[ \t]{0,3}(`{3,}|~{3,})/.exec(text)?.[1]
    if (marker) {
      if (!fence) fence = marker
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = undefined
    } else if (!fence && line >= minLines && text.trim() === "") {
      return markdown.slice(0, end + 1)
    }
    line++
    start = end + 1
  }
  return markdown
}
