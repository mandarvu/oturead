import { describe, expect, test } from "bun:test"
import { MATH_CLOSE as C, MATH_OPEN as O, mathToText, renderMathInMarkdown, replaceInlineMath } from "../src/math/markdown"

const mark = (line: string) => replaceInlineMath(line, (m) => `<${m}>`)

describe("replaceInlineMath", () => {
  test("renders $…$ and \\(…\\)", () => {
    expect(mark("Euler's identity is $e^{\\pi\\iota} = -1$.")).toBe("Euler's identity is <e^(πι) = −1>.")
    expect(mark("so \\(x^2\\) grows")).toBe("so <x²> grows")
    expect(mark("inline $$a_1$$ too")).toBe("inline <a₁> too")
  })

  test("leaves prices, escaped dollars and code alone", () => {
    expect(mark("costs $5 and $10 today")).toBe("costs $5 and $10 today")
    expect(mark("a \\$x\\$ b")).toBe("a \\$x\\$ b")
    expect(mark("run `echo $HOME $PATH` now")).toBe("run `echo $HOME $PATH` now")
    expect(mark("``a ` $x$ ``")).toBe("``a ` $x$ ``")
  })

  test("requires no space inside the dollars", () => {
    expect(mark("$ x$ and $x $")).toBe("$ x$ and $x $")
  })

  test("mathToText gives plain text", () => {
    expect(mathToText("The $O(n^2)$ case")).toBe("The O(n²) case")
  })
})

describe("renderMathInMarkdown", () => {
  test("display math becomes marked, indented rows mapped to the source", () => {
    const md = "Before\n\n$$\n\\frac{a}{b}\n$$\n\nAfter $x$"
    const { content, toSource } = renderMathInMarkdown(md)
    expect(content.split("\n")).toEqual(["Before", "", `${O}  a${C}`, `${O}  ─${C}`, `${O}  b${C}`, "", `After ${O}x${C}`])
    expect([0, 2, 3, 4, 5, 6].map(toSource)).toEqual([0, 2, 3, 4, 5, 6])
  })

  test("single-line $$…$$, \\[…\\] and bare environments are display math", () => {
    expect(renderMathInMarkdown("$$x^2$$").content).toBe(`${O}  x²${C}`)
    expect(renderMathInMarkdown("\\[ y_1 \\]").content).toBe(`${O}  y₁${C}`)
    const env = renderMathInMarkdown("\\begin{align}\na &= b \\\\\n&= c\n\\end{align}").content
    expect(env.split("\n")).toEqual([`${O}  a = b${C}`, `${O}    = c${C}`])
  })

  test("keeps blockquote prefixes on display rows", () => {
    expect(renderMathInMarkdown("> $$\n> x^2\n> $$").content).toBe(`> ${O}  x²${C}`)
  })

  test("an unclosed display block (still streaming) is left as is", () => {
    expect(renderMathInMarkdown("$$\n\\frac{a}{b}").content).toBe("$$\n\\frac{a}{b}")
  })

  test("math inside fenced code is not rendered", () => {
    const md = "```latex\n$x^2$\n$$\ny\n$$\n```"
    expect(renderMathInMarkdown(md).content).toBe(md)
  })
})
